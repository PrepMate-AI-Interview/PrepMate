using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using backend.Models.Jobs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace backend.Services.Jobs
{
    public class JoobleJobProvider : IJobProvider
    {
        private readonly HttpClient _httpClient;
        private readonly string? _apiKey;
        private readonly string _baseUrl;
        private readonly ILogger<JoobleJobProvider> _logger;

        public string ProviderName => "Jooble";
        public string SourceKey => "jooble";
        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

        public JoobleJobProvider(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<JoobleJobProvider> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _apiKey = Environment.GetEnvironmentVariable("JOOBLE_API_KEY")
                ?? configuration["Jobs:Jooble:ApiKey"];
            
            // Jooble REST API endpoint: POST https://jooble.org/api/{apiKey}
            // Regional endpoints (e.g. vn.jooble.org) are web portal domains; the verified public API base is https://jooble.org/api.
            _baseUrl = (Environment.GetEnvironmentVariable("JOOBLE_BASE_URL")
                ?? configuration["Jobs:Jooble:BaseUrl"]
                ?? "https://jooble.org/api").TrimEnd('/');
        }

        public ProviderStatus GetStatus()
        {
            var host = _baseUrl.Replace("https://", "").Replace("http://", "").Replace("/api", "");
            return new ProviderStatus
            {
                Name = ProviderName,
                SourceKey = SourceKey,
                IsEnabled = true,
                IsConfigured = IsConfigured,
                Mode = "DirectApi",
                Attribution = $"Dữ liệu việc làm chính thức từ Jooble REST API ({host})",
                StatusMessage = IsConfigured
                    ? $"Đang hoạt động (Đã cấu hình JOOBLE_API_KEY trên endpoint {host})"
                    : "Chưa cấu hình JOOBLE_API_KEY. Vui lòng thiết lập biến môi trường JOOBLE_API_KEY để kích hoạt tìm kiếm trực tiếp."
            };
        }

        public async Task<ProviderSearchResult> SearchJobsAsync(JobSearchQuery query, CancellationToken cancellationToken = default)
        {
            var result = new ProviderSearchResult
            {
                Status = GetStatus()
            };

            if (!IsConfigured)
            {
                result.ErrorMessage = "Jooble API chưa được cấu hình khóa truy cập.";
                return result;
            }

            try
            {
                var targetLocation = ResolveLocation(query.Location);
                var joobleKeywords = BuildJoobleKeywords(query.Keyword, query.Category);
                var joobleReq = new JoobleApiRequest
                {
                    Keywords = joobleKeywords,
                    Location = targetLocation,
                    Page = query.Page > 0 ? query.Page : 1,
                    ResultOnPage = query.PageSize > 0 && query.PageSize <= 50 ? query.PageSize : 10,
                    Salary = (int)(query.MinSalary ?? 0)
                };

                var url = $"{_baseUrl}/{_apiKey?.Trim()}";
                using var response = await _httpClient.PostAsJsonAsync(url, joobleReq, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var statusCode = (int)response.StatusCode;
                    var errBody = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogWarning("Jooble API returned HTTP {StatusCode}: {ErrorBody}", statusCode, errBody);
                    result.ErrorMessage = statusCode switch
                    {
                        401 or 403 => $"Khóa API Jooble không hợp lệ hoặc đã hết hạn (HTTP {statusCode}).",
                        429 => "Đã vượt quá hạn mức truy vấn Jooble API (HTTP 429).",
                        _ => $"Jooble API trả về mã lỗi HTTP {statusCode}."
                    };
                    return result;
                }

                var joobleData = await response.Content.ReadFromJsonAsync<JoobleApiResponse>(cancellationToken: cancellationToken);
                if (joobleData == null || joobleData.Jobs == null)
                {
                    result.TotalCount = 0;
                    return result;
                }

                result.TotalCount = joobleData.TotalCount;
                var list = new List<JobPostingDto>();

                foreach (var item in joobleData.Jobs)
                {
                    var cleanTitle = StripHtml(item.Title ?? "Vị trí tuyển dụng");
                    var cleanCompany = StripHtml(item.Company ?? "Doanh nghiệp tuyển dụng");
                    var cleanDesc = StripHtml(item.Snippet ?? string.Empty);
                    var cleanLocation = StripHtml(string.IsNullOrWhiteSpace(item.Location) ? targetLocation : item.Location.Trim());
                    var (minSal, maxSal, curr) = ParseSalary(item.Salary);

                    var logoChar = string.IsNullOrWhiteSpace(cleanCompany)
                        ? "J"
                        : cleanCompany[..1].ToUpperInvariant();

                    var safeLink = SanitizeUrl(item.Link);

                    list.Add(new JobPostingDto
                    {
                        Id = $"jooble_{item.Id ?? Guid.NewGuid().ToString("N")[..8]}",
                        Title = cleanTitle,
                        CompanyName = cleanCompany,
                        CompanyLogo = logoChar,
                        Location = cleanLocation,
                        SalaryMin = minSal,
                        SalaryMax = maxSal,
                        SalaryCurrency = curr,
                        SalaryText = item.Salary,
                        EmploymentType = string.IsNullOrWhiteSpace(item.Type) ? "Full-time" : StripHtml(item.Type.Trim()),
                        WorkMode = DetectWorkMode(cleanTitle, cleanLocation, cleanDesc),
                        Description = cleanDesc,
                        Skills = ExtractSkills(cleanDesc, cleanTitle),
                        PostedAt = TryParseDate(item.Updated),
                        PostedDays = CalculatePostedDays(item.Updated),
                        SourceName = "Jooble",
                        SourceKey = "jooble",
                        SourceUrl = safeLink,
                        ApplyUrl = safeLink,
                        FetchedAt = DateTime.UtcNow,
                        IsSample = false,
                        Featured = false,
                        MatchScore = CalculateMatchScore(cleanTitle, cleanDesc, query.Keyword, query.Category)
                    });
                }

                result.Jobs = list;
                result.Status.ResultCount = list.Count;
                return result;
            }
            catch (OperationCanceledException)
            {
                result.ErrorMessage = "Yêu cầu đến Jooble API đã bị quá thời gian chờ (timeout).";
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi gọi Jooble API: {Message}", ex.Message);
                result.ErrorMessage = "Không thể kết nối đến dịch vụ việc làm Jooble.";
                return result;
            }
        }

        private static string BuildJoobleKeywords(string? keyword, string? category)
        {
            var kw = (keyword ?? string.Empty).Trim();
            var cat = (category ?? string.Empty).Trim().ToLowerInvariant();

            var categoryTerm = cat switch
            {
                "tech" or "it" or "software" => "Software Developer IT Lập trình",
                "business" or "ba" => "Business Analyst Phân tích nghiệp vụ BA",
                "finance" or "accounting" or "banking" => "Finance Kế toán Tài chính Ngân hàng",
                "sales" or "bizdev" => "Sales Kinh doanh Bán hàng Account Executive",
                "marketing" or "media" => "Marketing Digital Marketing Truyền thông SEO",
                "hr" or "admin" or "legal" => "HR Tuyển dụng Nhân sự Pháp chế",
                "operations" or "logistics" or "supply-chain" => "Operations Vận hành Logistics Chuỗi cung ứng",
                "pm" or "po" => "Product Manager Project Manager Quản lý dự án",
                "design" or "creative" => "UI UX Designer Thiết kế đồ họa Graphic Design",
                "data" or "ai" => "Data Analyst Data Engineer Machine Learning Trí tuệ nhân tạo",
                "engineering" or "manufacturing" => "Kỹ sư Kỹ thuật Cơ khí Điện Sản xuất",
                "customer-service" => "Chăm sóc khách hàng Customer Service Hỗ trợ khách hàng",
                "education" => "Giáo viên Giảng viên Đào tạo Giáo dục",
                "healthcare" => "Y tế Dược sĩ Bác sĩ Điều dưỡng",
                "construction" or "real-estate" => "Xây dựng Bất động sản Kiến trúc sư",
                "hospitality" or "retail" => "Nhà hàng Khách sạn Bán lẻ F&B",
                _ => string.Empty
            };

            if (!string.IsNullOrWhiteSpace(kw) && !string.IsNullOrWhiteSpace(categoryTerm))
            {
                return $"{kw} {categoryTerm}";
            }

            if (!string.IsNullOrWhiteSpace(kw))
            {
                return kw;
            }

            if (!string.IsNullOrWhiteSpace(categoryTerm))
            {
                return categoryTerm;
            }

            // Broad neutral hiring term for Vietnam when no keyword or category is chosen
            return "tuyển dụng";
        }

        private static string ResolveLocation(string? loc)
        {
            if (string.IsNullOrWhiteSpace(loc)) return "Vietnam";
            var lower = loc.Trim().ToLowerInvariant();
            if (lower.Contains("hanoi") || lower.Contains("hà nội")) return "Hanoi, Vietnam";
            if (lower.Contains("hcm") || lower.Contains("hồ chí minh") || lower.Contains("saigon")) return "Ho Chi Minh City, Vietnam";
            if (lower.Contains("danang") || lower.Contains("đà nẵng")) return "Da Nang, Vietnam";
            if (lower.Contains("remote")) return "Remote, Vietnam";
            return $"{loc}, Vietnam";
        }

        private static string StripHtml(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var noHtml = Regex.Replace(input, "<.*?>", string.Empty);
            return WebUtility.HtmlDecode(noHtml).Trim();
        }

        private static string? SanitizeUrl(string? rawUrl)
        {
            if (string.IsNullOrWhiteSpace(rawUrl)) return null;
            var trimmed = rawUrl.Trim();
            if (trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
            {
                return trimmed;
            }
            return null;
        }

        private static (decimal? min, decimal? max, string curr) ParseSalary(string? salary)
        {
            if (string.IsNullOrWhiteSpace(salary)) return (null, null, "USD");
            var clean = salary.Replace(",", string.Empty).Replace(".", string.Empty);
            var matches = Regex.Matches(clean, @"\d+");
            if (matches.Count >= 2 && decimal.TryParse(matches[0].Value, out var m1) && decimal.TryParse(matches[1].Value, out var m2))
            {
                return (Math.Min(m1, m2), Math.Max(m1, m2), salary.Contains("₫") || salary.ToLower().Contains("vnd") ? "VND" : "USD");
            }
            if (matches.Count == 1 && decimal.TryParse(matches[0].Value, out var single))
            {
                return (single, null, salary.Contains("₫") || salary.ToLower().Contains("vnd") ? "VND" : "USD");
            }
            return (null, null, "USD");
        }

        private static string DetectWorkMode(string? title, string? loc, string? desc)
        {
            var combined = $"{title} {loc} {desc}".ToLowerInvariant();
            if (combined.Contains("remote") || combined.Contains("từ xa")) return "Remote";
            if (combined.Contains("hybrid")) return "Hybrid";
            return "On-site";
        }

        private static List<string> ExtractSkills(string desc, string? title)
        {
            var skills = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var dictionary = new[]
            {
                // Tech & Engineering
                "C#", ".NET", "Java", "Python", "JavaScript", "TypeScript", "React", "Angular", "Vue", "Next.js",
                "Node.js", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "Azure",
                "GCP", "CI/CD", "Git", "DevOps", "Linux", "Spring Boot", "Microservices", "REST API",
                // Data & Analytics
                "Data Analysis", "PowerBI", "Tableau", "Machine Learning", "AI", "Excel",
                // Product & Business
                "Business Analysis", "BPMN", "Scrum", "Agile", "Jira", "Product Management", "Project Management",
                // Design
                "Figma", "UI/UX", "Photoshop", "Illustrator",
                // Sales & Marketing
                "Sales", "B2B", "B2C", "Negotiation", "CRM", "Digital Marketing", "SEO", "Google Ads", "Content Creation",
                // Finance & HR & Operations
                "Kế toán", "Tài chính", "HR", "Recruitment", "Payroll", "Labor Law", "Supply Chain", "Logistics", "Customer Service"
            };

            var text = $"{title} {desc}";
            foreach (var kw in dictionary)
            {
                if (Regex.IsMatch(text, $@"\b{Regex.Escape(kw)}\b", RegexOptions.IgnoreCase))
                {
                    skills.Add(kw);
                }
            }

            if (skills.Count == 0)
            {
                skills.Add("Chuyên môn liên quan");
            }

            var list = new List<string>(skills);
            return list.Count > 6 ? list.GetRange(0, 6) : list;
        }

        private static DateTime? TryParseDate(string? dateStr)
        {
            if (string.IsNullOrWhiteSpace(dateStr)) return null;
            if (DateTime.TryParse(dateStr, out var dt)) return dt;
            return null;
        }

        private static int? CalculatePostedDays(string? dateStr)
        {
            var dt = TryParseDate(dateStr);
            if (!dt.HasValue) return 1;
            var diff = (DateTime.UtcNow - dt.Value).TotalDays;
            return Math.Max(1, (int)Math.Round(diff));
        }

        private static int CalculateMatchScore(string? title, string desc, string? keyword, string? category)
        {
            var score = 75;
            var t = (title ?? string.Empty).ToLowerInvariant();
            var d = desc.ToLowerInvariant();

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var kw = keyword.Trim().ToLowerInvariant();
                if (t.Contains(kw)) score += 15;
                else if (d.Contains(kw)) score += 8;
            }
            else
            {
                score += 5;
            }

            if (!string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                var cat = category.Trim().ToLowerInvariant();
                if (t.Contains(cat) || d.Contains(cat)) score += 7;
            }

            return Math.Clamp(score, 60, 99);
        }

        private class JoobleApiRequest
        {
            [JsonPropertyName("keywords")]
            public string Keywords { get; set; } = string.Empty;

            [JsonPropertyName("location")]
            public string Location { get; set; } = "Vietnam";

            [JsonPropertyName("page")]
            public int Page { get; set; } = 1;

            [JsonPropertyName("ResultOnPage")]
            public int ResultOnPage { get; set; } = 10;

            [JsonPropertyName("salary")]
            public int Salary { get; set; } = 0;
        }

        private class JoobleApiResponse
        {
            [JsonPropertyName("totalCount")]
            public int TotalCount { get; set; }

            [JsonPropertyName("jobs")]
            public List<JoobleJobItem>? Jobs { get; set; }
        }

        private class JoobleJobItem
        {
            [JsonPropertyName("id")]
            public string? Id { get; set; }

            [JsonPropertyName("title")]
            public string? Title { get; set; }

            [JsonPropertyName("location")]
            public string? Location { get; set; }

            [JsonPropertyName("snippet")]
            public string? Snippet { get; set; }

            [JsonPropertyName("salary")]
            public string? Salary { get; set; }

            [JsonPropertyName("source")]
            public string? Source { get; set; }

            [JsonPropertyName("type")]
            public string? Type { get; set; }

            [JsonPropertyName("link")]
            public string? Link { get; set; }

            [JsonPropertyName("company")]
            public string? Company { get; set; }

            [JsonPropertyName("updated")]
            public string? Updated { get; set; }
        }
    }
}
