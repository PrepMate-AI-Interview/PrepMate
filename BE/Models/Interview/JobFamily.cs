using System;

namespace backend.Models
{
    public static class JobFamily
    {
        public const string SOFTWARE_ENGINEERING = "SOFTWARE_ENGINEERING";
        public const string DATA_ANALYTICS = "DATA_ANALYTICS";
        public const string PRODUCT_PROJECT = "PRODUCT_PROJECT";
        public const string BUSINESS_ANALYSIS = "BUSINESS_ANALYSIS";
        public const string MARKETING_GROWTH = "MARKETING_GROWTH";
        public const string SALES_BUSINESS_DEVELOPMENT = "SALES_BUSINESS_DEVELOPMENT";
        public const string FINANCE_ACCOUNTING = "FINANCE_ACCOUNTING";
        public const string HR_PEOPLE = "HR_PEOPLE";
        public const string DESIGN_UX = "DESIGN_UX";
        public const string OPERATIONS_SUPPLY_CHAIN = "OPERATIONS_SUPPLY_CHAIN";
        public const string CUSTOMER_SUCCESS = "CUSTOMER_SUCCESS";
        public const string GENERAL_PROFESSIONAL = "GENERAL_PROFESSIONAL";
    }

    public static class ProfessionalDomainClassifier
    {
        public const string DefaultPositionTitle = "Chuyên viên chuyên môn";
        public const string DefaultTargetLevel = "Mid";

        public static string Classify(string? position, string? industry = null)
        {
            if (string.IsNullOrWhiteSpace(position))
            {
                if (!string.IsNullOrWhiteSpace(industry))
                {
                    return ClassifyFromText(industry);
                }
                return JobFamily.GENERAL_PROFESSIONAL;
            }

            return ClassifyFromText(position);
        }

        private static string ClassifyFromText(string text)
        {
            var lower = text.ToLowerInvariant();

            // 1. DATA_ANALYTICS (Check before generic SWE to properly route Data Science/Analytics)
            if (lower.Contains("data analyst") || lower.Contains("data scientist") ||
                lower.Contains("data engineer") || lower.Contains("bi analyst") ||
                lower.Contains("business intelligence") || lower.Contains("machine learning") ||
                lower.Contains("ai engineer") || lower.Contains("dữ liệu") ||
                lower.Contains("analytics") || lower.Contains("phân tích dữ liệu"))
            {
                return JobFamily.DATA_ANALYTICS;
            }

            // 2. BUSINESS_ANALYSIS (Check before generic dev/analysis to route BA properly)
            if (lower.Contains("business analyst") || lower.Contains("ba ") || lower.EndsWith(" ba") || lower == "ba" ||
                lower.Contains("chuyên viên phân tích nghiệp vụ") || lower.Contains("phân tích nghiệp vụ") ||
                lower.Contains("process analyst") || lower.Contains("quy trình nghiệp vụ") ||
                lower.Contains("requirements analyst") || lower.Contains("business operations analyst") ||
                lower.Contains("strategy analyst"))
            {
                return JobFamily.BUSINESS_ANALYSIS;
            }

            // 3. PRODUCT_PROJECT (Check before SWE so TPM / PM routes here)
            if (lower.Contains("product manager") || lower.Contains("product owner") ||
                lower.Contains("project manager") || lower.Contains("scrum master") ||
                lower.Contains("program manager") || lower.Contains("quản lý sản phẩm") ||
                lower.Contains("quản lý dự án") || lower.Contains("tpm") ||
                lower.Contains("delivery manager") || lower.Contains("agile coach"))
            {
                return JobFamily.PRODUCT_PROJECT;
            }

            // 4. SOFTWARE_ENGINEERING
            if (lower.Contains("developer") || lower.Contains("software engineer") ||
                lower.Contains("lập trình") || lower.Contains("backend") ||
                lower.Contains("frontend") || lower.Contains("fullstack") ||
                lower.Contains("full stack") || lower.Contains("kỹ sư phần mềm") ||
                lower.Contains("devops") || lower.Contains("cloud engineer") ||
                lower.Contains("system architect") || lower.Contains("kiến trúc sư hệ thống") ||
                lower.Contains("mobile dev") || lower.Contains("ios") || lower.Contains("android") ||
                lower.Contains("flutter") || lower.Contains("react native") ||
                lower.Contains("web developer") || lower.Contains("qa engineer") ||
                lower.Contains("tester") || lower.Contains("test automation") ||
                lower.Contains("security engineer") || lower.Contains("an toàn thông tin") ||
                lower.Contains("coder") || lower.Contains("programmer"))
            {
                return JobFamily.SOFTWARE_ENGINEERING;
            }

            // 5. MARKETING_GROWTH
            if (lower.Contains("marketing") || lower.Contains("tiếp thị") ||
                lower.Contains("growth") || lower.Contains("seo") ||
                lower.Contains("sem") || lower.Contains("copywriter") ||
                lower.Contains("content") || lower.Contains("truyền thông") ||
                lower.Contains("pr ") || lower.EndsWith(" pr") || lower == "pr" ||
                lower.Contains("quan hệ công chúng") || lower.Contains("brand manager") ||
                lower.Contains("performance marketing") || lower.Contains("social media"))
            {
                return JobFamily.MARKETING_GROWTH;
            }

            // 6. SALES_BUSINESS_DEVELOPMENT
            if (lower.Contains("sales") || lower.Contains("kinh doanh") ||
                lower.Contains("bán hàng") || lower.Contains("business development") ||
                lower.Contains("account executive") || lower.Contains("b2b") ||
                lower.Contains("key account") || lower.Contains("phát triển thị trường") ||
                lower.Contains("commercial") || lower.Contains("telesales"))
            {
                return JobFamily.SALES_BUSINESS_DEVELOPMENT;
            }

            // 7. FINANCE_ACCOUNTING
            if (lower.Contains("finance") || lower.Contains("financial") ||
                lower.Contains("tài chính") || lower.Contains("kế toán") ||
                lower.Contains("accountant") || lower.Contains("accounting") ||
                lower.Contains("auditor") || lower.Contains("kiểm toán") ||
                lower.Contains("ngân hàng") || lower.Contains("banking") ||
                lower.Contains("đầu tư") || lower.Contains("investment") ||
                lower.Contains("cfo") || lower.Contains("thuế") || lower.Contains("tax"))
            {
                return JobFamily.FINANCE_ACCOUNTING;
            }

            // 8. HR_PEOPLE
            if (lower.Contains("hr") || lower.Contains("human resources") ||
                lower.Contains("nhân sự") || lower.Contains("talent") ||
                lower.Contains("recruiter") || lower.Contains("tuyển dụng") ||
                lower.Contains("headhunt") || lower.Contains("c&b") ||
                lower.Contains("compensation") || lower.Contains("people operations") ||
                lower.Contains("đào tạo") || lower.Contains("l&d"))
            {
                return JobFamily.HR_PEOPLE;
            }

            // 9. DESIGN_UX
            if (lower.Contains("design") || lower.Contains("thiết kế") ||
                lower.Contains("ui/ux") || lower.Contains("ui ") || lower.Contains("ux ") ||
                lower.Contains("graphic") || lower.Contains("đồ họa") ||
                lower.Contains("art director") || lower.Contains("visual designer"))
            {
                return JobFamily.DESIGN_UX;
            }

            // 10. OPERATIONS_SUPPLY_CHAIN
            if (lower.Contains("operations") || lower.Contains("vận hành") ||
                lower.Contains("supply chain") || lower.Contains("chuỗi cung ứng") ||
                lower.Contains("logistics") || lower.Contains("kho vận") ||
                lower.Contains("procurement") || lower.Contains("purchasing") ||
                lower.Contains("mua hàng") || lower.Contains("xuất nhập khẩu") ||
                lower.Contains("import export"))
            {
                return JobFamily.OPERATIONS_SUPPLY_CHAIN;
            }

            // 11. CUSTOMER_SUCCESS
            if (lower.Contains("customer success") || lower.Contains("cskh") ||
                lower.Contains("chăm sóc khách hàng") || lower.Contains("customer support") ||
                lower.Contains("hỗ trợ khách hàng") || lower.Contains("customer experience") ||
                lower.Contains("cx ") || lower.EndsWith(" cx") || lower == "cx")
            {
                return JobFamily.CUSTOMER_SUCCESS;
            }

            return JobFamily.GENERAL_PROFESSIONAL;
        }
    }
}
