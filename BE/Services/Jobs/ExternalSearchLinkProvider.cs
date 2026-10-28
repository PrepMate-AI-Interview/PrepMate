using System;
using System.Collections.Generic;
using System.Net;
using backend.Models.Jobs;

namespace backend.Services.Jobs
{
    public class ExternalSearchLinkProvider
    {
        public List<ExternalSearchLink> GenerateLinks(JobSearchQuery query)
        {
            var rawKw = query.Keyword?.Trim() ?? string.Empty;
            var rawCat = query.Category?.Trim().ToLowerInvariant() ?? string.Empty;
            string defaultTerm = rawCat switch
            {
                "business" or "ba" => "Business Analyst",
                "finance" or "accounting" => "Tài chính Kế toán",
                "marketing" => "Marketing",
                "sales" => "Kinh doanh Bán hàng",
                "hr" => "Nhân sự Tuyển dụng",
                "operations" => "Vận hành Supply Chain",
                "design" => "UI UX Design",
                "data" => "Data AI",
                "pm" => "Product Manager",
                "tech" or "it" or "software" => "phần mềm",
                _ => "tuyển dụng"
            };
            var kw = string.IsNullOrWhiteSpace(rawKw) ? defaultTerm : rawKw;
            var encodedKw = WebUtility.UrlEncode(kw);
            
            var loc = query.Location?.Trim().ToLowerInvariant() ?? string.Empty;
            var linkedInLoc = loc switch
            {
                "hanoi" => "Hanoi, Vietnam",
                "hcm" => "Ho Chi Minh City, Vietnam",
                "danang" => "Da Nang, Vietnam",
                _ => "Vietnam"
            };
            var encodedLinkedInLoc = WebUtility.UrlEncode(linkedInLoc);

            var topCvCityParam = loc switch
            {
                "hanoi" => "&city=1",
                "hcm" => "&city=2",
                "danang" => "&city=3",
                _ => string.Empty
            };

            return new List<ExternalSearchLink>
            {
                new ExternalSearchLink
                {
                    PlatformName = "TopCV",
                    PlatformKey = "topcv",
                    SearchUrl = $"https://www.topcv.vn/tim-viec-lam?keyword={encodedKw}{topCvCityParam}",
                    BadgeColor = "#00b14f",
                    Description = "Tìm việc trên cổng TopCV Việt Nam theo từ khóa thực tế"
                },
                new ExternalSearchLink
                {
                    PlatformName = "VietnamWorks",
                    PlatformKey = "vietnamworks",
                    SearchUrl = $"https://www.vietnamworks.com/viec-lam?q={encodedKw}",
                    BadgeColor = "#005aff",
                    Description = "Khám phá việc làm trung & cao cấp trên VietnamWorks"
                },
                new ExternalSearchLink
                {
                    PlatformName = "ITviec",
                    PlatformKey = "itviec",
                    SearchUrl = $"https://itviec.com/it-jobs?query={encodedKw}",
                    BadgeColor = "#ed1b2f",
                    Description = "Tra cứu tin tuyển dụng chuyên ngành CNTT trên ITviec"
                },
                new ExternalSearchLink
                {
                    PlatformName = "CareerViet",
                    PlatformKey = "careerviet",
                    SearchUrl = $"https://careerviet.vn/tim-viec-lam?keywords={encodedKw}",
                    BadgeColor = "#e60023",
                    Description = "Tìm kiếm cơ hội việc làm đa ngành trên CareerViet (CareerBuilder VN)"
                },
                new ExternalSearchLink
                {
                    PlatformName = "LinkedIn",
                    PlatformKey = "linkedin",
                    SearchUrl = $"https://www.linkedin.com/jobs/search/?keywords={encodedKw}&location={encodedLinkedInLoc}",
                    BadgeColor = "#0a66c2",
                    Description = "Mạng lưới cơ hội nghề nghiệp và kết nối tuyển dụng LinkedIn"
                }
            };
        }
    }
}
