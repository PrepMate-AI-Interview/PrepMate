/**
 * PREPMATE — INDUSTRY TAXONOMY & DOMAIN-AWARE SETUP MODULE
 * Defines 20 standard industry taxonomy groups, popular suggested roles,
 * search filters, and contextual domain-specific profile fields.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PrepMateTaxonomy = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {

  // 11 Core Primary Sectors for Simplified, High-Clarity UI Setup
  const PRIMARY_SECTORS = [
    {
      id: "tech_engineering",
      name: "Công nghệ & Kỹ thuật",
      tag: "Công nghệ",
      desc: "Phần mềm, hệ thống, an ninh mạng, dữ liệu, điện tử & tự động hóa",
      mappedTaxonomyId: "it_software",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      roles: [
        "Frontend Developer",
        "Backend Developer",
        "Software Tester / QA",
        "IT Support / Helpdesk",
        "Business Analyst",
        "Data Analyst",
        "DevOps / Cloud Engineer",
        "Kỹ sư điện / tự động hóa"
      ],
      suggestedCompanies: [
        "FPT Software",
        "Tập đoàn Viettel",
        "VNG Corporation",
        "VNPT Group",
        "MoMo",
        "KMS Technology"
      ],
      roleTiers: {
              "entry": [
                      "Thực tập sinh IT / Software Intern",
                      "Fresher Developer",
                      "IT Support / Helpdesk",
                      "Junior QA / Tester"
              ],
              "professional": [
                      "Frontend Developer",
                      "Backend Developer",
                      "Business Analyst",
                      "Data Analyst",
                      "DevOps / Cloud Engineer",
                      "Kỹ sư điện / tự động hóa",
                      "Software Tester / QA"
              ],
              "senior_lead": [
                      "Senior Software Engineer",
                      "Solution Architect",
                      "Tech Lead / Team Lead IT",
                      "Engineering Manager / Trưởng phòng CNTT"
              ]
      },
      contextFields: {
        domainTitle: "Bổ trợ Kỹ thuật & Công nghệ",
        hint: "Giúp AI đào sâu đúng stack công nghệ và bài toán kiến trúc bạn đang làm việc.",
        fields: [
          { id: "ctx_tech_stack", label: "Ngôn ngữ & Framework trọng tâm", placeholder: "Ví dụ: .NET Core, React, Spring Boot, Node.js, Golang, AWS, Docker..." },
          { id: "ctx_tech_challenge", label: "Bài toán kỹ thuật muốn thử thách", placeholder: "Ví dụ: Tối ưu hiệu năng database, thiết kế microservices, concurrency..." }
        ]
      }
    },
    {
      id: "business_commerce",
      name: "Kinh tế & Kinh doanh",
      tag: "Kinh doanh",
      desc: "Bán hàng B2B/B2C, phát triển thị trường, quan hệ đối tác & thành công khách hàng",
      mappedTaxonomyId: "sales_business_customer",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 7h-7L10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>`,
      roles: [
        "Nhân viên kinh doanh",
        "Chuyên viên phát triển kinh doanh",
        "Chuyên viên chăm sóc khách hàng",
        "Customer Success",
        "Business Development",
        "Key Account Manager (KAM)"
      ],
      suggestedCompanies: [
        "Shopee / Sea Group",
        "Lazada Vietnam",
        "Tiki",
        "Thế Giới Di Động",
        "Tập đoàn PNJ",
        "Masan Consumer"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Kinh doanh & Khách hàng",
        hint: "Cung cấp mô hình bán hàng và phân khúc khách hàng bạn thường đàm phán.",
        fields: [
          { id: "ctx_sales_model", label: "Mô hình bán hàng & Khách hàng mục tiêu", placeholder: "Ví dụ: B2B Doanh nghiệp lớn (Enterprise), SMEs, B2C, đại lý..." },
          { id: "ctx_sales_metrics", label: "Chỉ số doanh thu hoặc quy mô hợp đồng", placeholder: "Ví dụ: Hợp đồng từ 100M - 1 tỷ, doanh số tháng 500M, tỷ lệ chốt Deal..." }
        ]
      }
    },
    {
      id: "finance_banking",
      name: "Tài chính, Ngân hàng & Kế toán",
      tag: "Tài chính",
      desc: "Ngân hàng số, tín dụng, kế toán doanh nghiệp, kiểm toán & phân tích đầu tư",
      mappedTaxonomyId: "finance_banking_accounting",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="18"/></svg>`,
      roles: [
        "Chuyên viên quan hệ khách hàng",
        "Chuyên viên tín dụng",
        "Giao dịch viên ngân hàng",
        "Kế toán viên",
        "Chuyên viên phân tích tài chính",
        "Kiểm toán viên"
      ],
      suggestedCompanies: [
        "Techcombank",
        "Vietcombank",
        "Ngân hàng Quân đội MB",
        "VPBank",
        "Ngân hàng ACB",
        "PwC Vietnam"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Tài chính, Ngân hàng & Kế toán",
        hint: "Làm rõ chuẩn mực kế toán hoặc chỉ số tài chính, huy động, cho vay bạn phụ trách.",
        fields: [
          { id: "ctx_fin_standards", label: "Chuẩn mực / Phần mềm kế toán - ngân hàng", placeholder: "Ví dụ: VAS, IFRS, Core Banking (T24), MISA, SAP, FAST..." },
          { id: "ctx_fin_metrics", label: "Chỉ số KPI hoặc danh mục quản lý", placeholder: "Ví dụ: Huy động vốn, dư nợ tín dụng, lập BCTC, thẩm định hồ sơ..." }
        ]
      }
    },
    {
      id: "marketing_comms",
      name: "Marketing & Truyền thông",
      tag: "Marketing",
      desc: "Tiếp thị kỹ thuật số, nội dung sáng tạo, SEO/SEM, quảng cáo đa kênh & quan hệ công chúng",
      mappedTaxonomyId: "marketing_ecommerce",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      roles: [
        "Digital Marketing",
        "Content Marketing",
        "SEO Specialist",
        "Performance Marketing",
        "Social Media",
        "Chuyên viên truyền thông",
        "Copywriter"
      ],
      suggestedCompanies: [
        "Dentsu Vietnam",
        "Ogilvy Vietnam",
        "VNG Games",
        "Shopee",
        "Unilever Vietnam",
        "DatVietVAC"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Marketing & Truyền thông",
        hint: "Giúp người phỏng vấn đặt câu hỏi sát với chiến dịch và số liệu tăng trưởng bạn từng thực hiện.",
        fields: [
          { id: "ctx_mkt_channels", label: "Kênh truyền thông / Nền tảng trọng tâm", placeholder: "Ví dụ: Facebook Ads, Google Ads, TikTok, SEO, Email Marketing, sàn TMĐT..." },
          { id: "ctx_mkt_goals", label: "Mục tiêu & Chỉ số đo lường chính (KPI)", placeholder: "Ví dụ: Tối ưu CAC/CPA, tăng trưởng ROI/ROAS, tăng lượng traffic, chuyển đổi Lead..." }
        ]
      }
    },
    {
      id: "hr_admin",
      name: "Nhân sự & Hành chính",
      tag: "Nhân sự",
      desc: "Tuyển dụng nhân tài, tiền lương & phúc lợi (C&B), đào tạo L&D, văn hóa & vận hành văn phòng",
      mappedTaxonomyId: "hr_training_people",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      roles: [
        "Chuyên viên tuyển dụng",
        "HR Generalist",
        "C&B Specialist",
        "Learning & Development",
        "Trợ lý hành chính",
        "HR Business Partner (HRBP)"
      ],
      suggestedCompanies: [
        "Navigos Group",
        "Adecco Vietnam",
        "ManpowerGroup",
        "FPT Software",
        "Tập đoàn Vingroup",
        "Talentnet"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Nhân sự & Quản trị con người",
        hint: "Làm rõ quy mô nhân sự và bài toán quản trị nhân sự bạn phụ trách.",
        fields: [
          { id: "ctx_hr_scope", label: "Mảng nhân sự chuyên sâu & Quy mô công ty", placeholder: "Ví dụ: Tuyển dụng IT quy mô 300 nhân sự, tính lương thưởng C&B, đào tạo nội bộ..." },
          { id: "ctx_hr_challenges", label: "Bài toán nhân sự muốn thực hành", placeholder: "Ví dụ: Giảm tỷ lệ nghỉ việc (Turnover rate), giữ chân nhân tài, xử lý kỷ luật..." }
        ]
      }
    },
    {
      id: "manufacturing_logistics",
      name: "Sản xuất & Logistics",
      tag: "Vận hành",
      desc: "Quản lý chuỗi cung ứng, kho vận, xuất nhập khẩu, kỹ thuật sản xuất & quản trị chất lượng",
      mappedTaxonomyId: "logistics_supplychain",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
      roles: [
        "Kỹ sư quản lý chất lượng (QA/QC)",
        "Quản đốc phân xưởng",
        "Chuyên viên xuất nhập khẩu",
        "Chuyên viên thu mua (Procurement)",
        "Điều phối kho vận / Kho bãi",
        "Quản trị chuỗi cung ứng"
      ],
      suggestedCompanies: [
        "Viettel Post",
        "Giao Hàng Nhanh (GHN)",
        "Shopee Xpress",
        "VinFast",
        "Samsung Electronics",
        "Tập đoàn TH True Milk"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Sản xuất & Vận hành Chuỗi cung ứng",
        hint: "Bổ sung tiêu chuẩn quản lý, phần mềm kho vận hoặc quy mô chuỗi cung ứng.",
        fields: [
          { id: "ctx_log_standards", label: "Tiêu chuẩn / Phương pháp hoặc phần mềm", placeholder: "Ví dụ: Incoterms, WMS, SAP SCM, ISO 9001, 5S, Kaizen..." },
          { id: "ctx_log_challenges", label: "Bài toán vận hành muốn cải thiện", placeholder: "Ví dụ: Tối ưu chi phí lưu kho, rút ngắn thời gian giao hàng (Lead time), xử lý hải quan..." }
        ]
      }
    },
    {
      id: "construction_realestate",
      name: "Xây dựng & Bất động sản",
      tag: "Xây dựng",
      desc: "Thiết kế kiến trúc, kết cấu công trình, giám sát thi công, dự toán QS & đầu tư BĐS",
      mappedTaxonomyId: "construction_architecture",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h1M9 13h1M9 17h1"/></svg>`,
      roles: [
        "Kỹ sư xây dựng dân dụng",
        "Kiến trúc sư thiết kế",
        "Kỹ sư giám sát thi công",
        "Kỹ sư dự toán (QS)",
        "Chuyên viên môi giới BĐS",
        "Thẩm định dự án BĐS"
      ],
      suggestedCompanies: [
        "Coteccons",
        "Tập đoàn Xây dựng Hòa Bình",
        "Vingroup (Vinhomes)",
        "Novaland",
        "Masterise Homes",
        "Tập đoàn Đất Xanh"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Công trình & Bất động sản",
        hint: "Bổ sung loại hình công trình hoặc phân khúc dự án bạn phụ trách.",
        fields: [
          { id: "ctx_const_project_type", label: "Loại hình công trình / Phân khúc", placeholder: "Ví dụ: Tòa nhà cao tầng, chung cư, hạ tầng giao thông, BĐS nghỉ dưỡng..." },
          { id: "ctx_const_tools", label: "Công cụ hoặc quy chuẩn xây dựng", placeholder: "Ví dụ: AutoCAD, Revit BIM, TCVN, FIDIC, dự toán G8..." }
        ]
      }
    },
    {
      id: "education_training",
      name: "Giáo dục & Đào tạo",
      tag: "Giáo dục",
      desc: "Giảng dạy, phát triển chương trình học thuật, đào tạo kỹ năng & quản lý giáo dục",
      mappedTaxonomyId: "education_research",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      roles: [
        "Giảng viên / Giáo viên",
        "Chuyên viên phát triển chương trình đào tạo",
        "Chuyên viên tư vấn tuyển sinh",
        "Nghiên cứu viên",
        "Quản lý học thuật / Academic Manager"
      ],
      suggestedCompanies: [
        "Tổ chức Giáo dục FPT",
        "Hệ thống Vinschool",
        "Hệ thống Anh văn ILA",
        "RMIT University Vietnam",
        "Tổ chức Giáo dục Topica",
        "Language Link Vietnam"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Giáo dục & Đào tạo",
        hint: "Cung cấp cấp bậc đào tạo và phương pháp sư phạm bạn thường áp dụng.",
        fields: [
          { id: "ctx_edu_level", label: "Cấp bậc đào tạo & Môn học chuyên sâu", placeholder: "Ví dụ: Đại học, THPT, đào tạo nghề, tiếng Anh IELTS, STEM..." },
          { id: "ctx_edu_methodology", label: "Phương pháp giảng dạy / Thiết kế khóa học", placeholder: "Ví dụ: Blended Learning, lớp học đảo ngược, phương pháp ADDIE..." }
        ]
      }
    },
    {
      id: "healthcare_medical",
      name: "Y tế & Chăm sóc sức khỏe",
      tag: "Y tế",
      desc: "Khám chữa bệnh, điều dưỡng, dược phẩm, thiết bị y tế & nghiên cứu y sinh",
      mappedTaxonomyId: "healthcare_pharma",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
      roles: [
        "Bác sĩ chuyên khoa",
        "Dược sĩ tư vấn",
        "Điều dưỡng viên",
        "Trình dược viên",
        "Kỹ thuật viên xét nghiệm / Chẩn đoán hình ảnh"
      ],
      suggestedCompanies: [
        "Hệ thống Y tế Vinmec",
        "Chuỗi Nhà thuốc Pharmacity",
        "Nhà thuốc FPT Long Châu",
        "Bệnh viện Chợ Rẫy",
        "Tập đoàn Sanofi Vietnam",
        "Dược Hậu Giang (DHG Pharma)"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Y tế & Dược phẩm",
        hint: "Bổ sung chuyên khoa và môi trường khám chữa bệnh hoặc phân phối y dược.",
        fields: [
          { id: "ctx_med_specialty", label: "Chuyên khoa / Dòng sản phẩm y dược", placeholder: "Ví dụ: Nội khoa, Tim mạch, Dược bệnh viện, Thiết bị y tế OTC/ETC..." },
          { id: "ctx_med_setting", label: "Môi trường công tác", placeholder: "Ví dụ: Bệnh viện tuyến đầu, phòng khám đa khoa quốc tế, hãng dược..." }
        ]
      }
    },
    {
      id: "hospitality_services",
      name: "Dịch vụ, Du lịch & Khách sạn",
      tag: "Dịch vụ",
      desc: "Quản trị lưu trú, nhà hàng - ẩm thực (F&B), lữ hành, tổ chức sự kiện & dịch vụ khách hàng",
      mappedTaxonomyId: "hospitality_tourism_events",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="6" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
      roles: [
        "Quản lý nhà hàng / Khách sạn",
        "Quản trị sự kiện",
        "Điều hành tour / Du lịch",
        "Chuyên viên dịch vụ khách hàng F&B",
        "Bếp trưởng / Giám sát vận hành ẩm thực"
      ],
      suggestedCompanies: [
        "Vinpearl",
        "Tập đoàn Sun Group",
        "Golden Gate Group",
        "Tổng công ty Saigontourist",
        "Khách sạn InterContinental",
        "Tập đoàn Marriott"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Dịch vụ & Khách sạn",
        hint: "Bổ sung phân khúc dịch vụ hoặc tiêu chuẩn đón tiếp khách hàng của bạn.",
        fields: [
          { id: "ctx_hosp_tier", label: "Phân khúc dịch vụ & Chuẩn sao", placeholder: "Ví dụ: Khách sạn 4-5 sao, chuỗi nhà hàng fine dining, tour du lịch outbound..." },
          { id: "ctx_hosp_standards", label: "Kỹ năng / Tiêu chuẩn phục vụ", placeholder: "Ví dụ: Xử lý khiếu nại khách hàng, tiêu chuẩn HACCP, quản lý đội ngũ tiền sảnh..." }
        ]
      }
    },
    {
      id: "custom_other",
      name: "Khác / Tự nhập vị trí",
      tag: "Mở rộng",
      desc: "Dành cho các ngành nghề chuyên biệt hoặc vị trí liên ngành không thuộc các nhóm trên",
      mappedTaxonomyId: "other_professions",
      iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      roles: [
        "Vị trí chuyên môn tự do",
        "Chuyên gia tư vấn độc lập",
        "Quản lý vận hành tổng hợp"
      ],
      suggestedCompanies: [
        "Startup công nghệ",
        "Doanh nghiệp tư nhân",
        "Tổ chức phi chính phủ (NGO)",
        "Tập đoàn đa ngành"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Bối cảnh Chuyên môn",
        hint: "Mô tả ngắn gọn bối cảnh đặc thù để AI cá nhân hóa câu hỏi phù hợp nhất.",
        fields: [
          { id: "ctx_other_scope", label: "Lĩnh vực & Phạm vi công việc chính", placeholder: "Ví dụ: Phân tích dữ liệu phi chính phủ, nông nghiệp công nghệ cao, quản lý quỹ..." },
          { id: "ctx_other_focus", label: "Trọng tâm thử thách bạn muốn luyện tập", placeholder: "Ví dụ: Khả năng thích ứng nhanh, xử lý tình huống đa nhiệm..." }
        ]
      }
    }
  ];

  const INDUSTRY_TAXONOMY = [
    {
      id: "it_software",
      name: "IT & Phần mềm",
      tag: "Công nghệ",
      desc: "Lập trình, kiến trúc hệ thống, đám mây, dữ liệu, trí tuệ nhân tạo (AI) & an toàn thông tin",
      backendJobFamily: "SOFTWARE_ENGINEERING",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      roles: [
        "Software Engineer",
        "Backend Developer",
        "Frontend Developer",
        "Full Stack Developer",
        "DevOps / Cloud Engineer",
        "QA / Test Automation Engineer",
        "Data Engineer",
        "Data Scientist / AI Engineer",
        "Mobile Developer (iOS / Android)"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Kỹ thuật & Công nghệ",
        hint: "Giúp AI đào sâu đúng stack công nghệ và bài toán kiến trúc bạn đang làm việc.",
        fields: [
          { id: "ctx_tech_stack", label: "Ngôn ngữ & Framework trọng tâm", placeholder: "Ví dụ: .NET Core, React, Spring Boot, Node.js, Golang, AWS, Docker..." },
          { id: "ctx_tech_challenge", label: "Bài toán kỹ thuật muốn thử thách", placeholder: "Ví dụ: Tối ưu hiệu năng database, thiết kế microservices, concurrency..." }
        ]
      }
    },
    {
      id: "engineering_manufacturing",
      name: "Kỹ thuật, Sản xuất & Chất lượng",
      tag: "Sản xuất",
      desc: "Kỹ thuật cơ khí, điện - điện tử, tự động hóa, QA/QC xưởng và quản lý dây chuyền sản xuất",
      backendJobFamily: "OPERATIONS_SUPPLY_CHAIN",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      roles: [
        "Kỹ sư Cơ khí Chế tạo",
        "Kỹ sư Điện - Điện tử",
        "Kỹ sư Tự động hóa / PLC",
        "Kỹ sư Quản lý Chất lượng (QA/QC)",
        "Quản đốc Phân xưởng / Sản xuất",
        "Kỹ sư Bảo trì & Vận hành Nhà máy"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Kỹ thuật & Sản xuất",
        hint: "Bổ sung tiêu chuẩn quản lý chất lượng và dây chuyền vận hành của bạn.",
        fields: [
          { id: "ctx_mfg_standards", label: "Tiêu chuẩn / Phương pháp quản trị", placeholder: "Ví dụ: ISO 9001, 5S, Kaizen, Lean Six Sigma, FMEA..." },
          { id: "ctx_mfg_focus", label: "Quy mô dây chuyền hoặc bài toán cải tiến", placeholder: "Ví dụ: Tối ưu chỉ số OEE, giảm phế phẩm, bảo trì phòng ngừa (PM)..." }
        ]
      }
    },
    {
      id: "construction_architecture",
      name: "Xây dựng, Kiến trúc & Bất động sản",
      tag: "Xây dựng",
      desc: "Thiết kế kiến trúc, kết cấu công trình, giám sát thi công, định giá và môi giới dự án BĐS",
      backendJobFamily: "GENERAL_PROFESSIONAL",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h1M9 13h1M9 17h1"/></svg>`,
      roles: [
        "Kỹ sư Xây dựng Dân dụng",
        "Kiến trúc sư Thiết kế (Architect)",
        "Kỹ sư Giám sát Thi công / Chỉ huy trưởng",
        "Kỹ sư Dự toán (QS Engineer)",
        "Chuyên viên Môi giới Bất động sản",
        "Chuyên viên Thẩm định Dự án BĐS"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Công trình & Bất động sản",
        hint: "Bổ sung loại hình công trình hoặc phân khúc dự án bạn phụ trách.",
        fields: [
          { id: "ctx_const_project_type", label: "Loại hình công trình / Phân khúc", placeholder: "Ví dụ: Tòa nhà cao tầng, chung cư, hạ tầng giao thông, BĐS nghỉ dưỡng..." },
          { id: "ctx_const_tools", label: "Công cụ hoặc quy chuẩn xây dựng", placeholder: "Ví dụ: AutoCAD, Revit BIM, TCVN, FIDIC, dự toán G8..." }
        ]
      }
    },
    {
      id: "ba_product_project",
      name: "Phân tích nghiệp vụ, Sản phẩm & Dự án",
      tag: "Nghiệp vụ",
      desc: "Khảo sát và mô hình hóa quy trình, thiết kế giải pháp sản phẩm, quản trị tiến độ dự án Agile/Scrum",
      backendJobFamily: "BUSINESS_ANALYSIS",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      roles: [
        "Business Analyst",
        "Product Manager",
        "Project Manager",
        "Scrum Master / Agile Coach",
        "Product Owner",
        "Chuyên viên Phân tích Quy trình"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Phân tích Nghiệp vụ & Dự án",
        hint: "Làm rõ phạm vi nghiệp vụ và phương pháp luận quản trị dự án bạn áp dụng.",
        fields: [
          { id: "ctx_ba_deliverables", label: "Tài liệu / Công cụ nghiệp vụ chính", placeholder: "Ví dụ: BRD, SRS, Use Case, User Story, BPMN, Jira, Confluence..." },
          { id: "ctx_ba_stakeholders", label: "Bên liên quan & Thử thách quy trình", placeholder: "Ví dụ: Đồng thuận Stakeholders kinh doanh với Dev, quản trị scope creep..." }
        ]
      }
    },
    {
      id: "sales_business_customer",
      name: "Kinh doanh, Bán hàng & Dịch vụ khách hàng",
      tag: "Kinh doanh",
      desc: "Phát triển thị trường B2B/B2C, đàm phán thương mại, quản lý tài khoản trọng yếu và chăm sóc khách hàng",
      backendJobFamily: "SALES_BUSINESS_DEVELOPMENT",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 7h-7L10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>`,
      roles: [
        "B2B Sales Executive",
        "Key Account Manager (KAM)",
        "Business Development Specialist",
        "Chuyên viên Tư vấn Bán hàng",
        "Customer Success Manager",
        "Chuyên viên Chăm sóc Khách hàng (CSKH)"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Kinh doanh & Khách hàng",
        hint: "Cung cấp mô hình bán hàng và chân dung khách hàng bạn thường đàm phán.",
        fields: [
          { id: "ctx_sales_model", label: "Mô hình bán hàng & Khách hàng mục tiêu", placeholder: "Ví dụ: B2B Doanh nghiệp lớn (Enterprise), SMEs, B2C, phân phối đại lý..." },
          { id: "ctx_sales_metrics", label: "Chỉ số hoặc quy mô hợp đồng trung bình", placeholder: "Ví dụ: Hợp đồng từ 100M - 1 tỷ, doanh số tháng 500M, tỷ lệ chốt Deal..." }
        ]
      }
    },
    {
      id: "marketing_ecommerce",
      name: "Marketing, Quảng cáo & Thương mại điện tử",
      tag: "Marketing",
      desc: "Tăng trưởng số, chạy chiến dịch quảng cáo đa kênh, SEO/SEM, tiếp thị thương hiệu và vận hành gian hàng sàn",
      backendJobFamily: "MARKETING_GROWTH",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      roles: [
        "Digital Marketing Specialist",
        "Performance Ads Specialist",
        "SEO / SEM Specialist",
        "E-Commerce Operation Specialist",
        "Brand Marketing Executive",
        "Growth Marketing Lead"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Chiến dịch & Kênh Marketing",
        hint: "Bổ sung kênh truyền thông và mục tiêu đo lường chính của bạn.",
        fields: [
          { id: "ctx_mkt_channels", label: "Kênh tiếp thị & Ngân sách vận hành", placeholder: "Ví dụ: Meta Ads, Google Ads, TikTok Shop, Shopee/Lazada, SEO On-page..." },
          { id: "ctx_mkt_kpi", label: "Chỉ số đo lường trọng tâm", placeholder: "Ví dụ: ROAS, CAC, CPL, Conversion Rate, GMV, Organic Traffic..." }
        ]
      }
    },
    {
      id: "media_pr_journalism",
      name: "Truyền thông, Báo chí & PR",
      tag: "Truyền thông",
      desc: "Quan hệ báo chí và công chúng, truyền thông nội bộ, xử lý khủng hoảng thông tin và biên tập nội dung xã hội",
      backendJobFamily: "MARKETING_GROWTH",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
      roles: [
        "Chuyên viên Quan hệ Công chúng (PR)",
        "Chuyên viên Truyền thông Nội bộ",
        "Phóng viên / Nhà báo / Biên tập viên",
        "Chuyên viên Quản trị Khủng hoảng Truyền thông",
        "Corporate Communications Executive"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Truyền thông & Báo chí",
        hint: "Giúp người phỏng vấn đánh giá năng lực ứng biến truyền thông và định hướng thông điệp.",
        fields: [
          { id: "ctx_pr_focus", label: "Mảng truyền thông hoặc đối tượng công chúng", placeholder: "Ví dụ: Báo chí tài chính, thông điệp thương hiệu doanh nghiệp, truyền thông nội bộ..." },
          { id: "ctx_pr_crisis", label: "Tình huống truyền thông quan tâm", placeholder: "Ví dụ: Xử lý sự cố mạng xã hội, họp báo công bố sản phẩm mới..." }
        ]
      }
    },
    {
      id: "content_creative_design",
      name: "Content Creator, Media & Sáng tạo",
      tag: "Sáng tạo",
      desc: "Sáng tạo nội dung số, video short-form/long-form, copywriting, thiết kế đồ họa, UI/UX và đạo diễn nghệ thuật",
      backendJobFamily: "DESIGN_UX",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
      roles: [
        "Content Creator / Video Producer",
        "Copywriter / Content Lead",
        "UI/UX Designer",
        "Graphic Designer",
        "Motion Designer / Video Editor",
        "Art Director / Creative Lead"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Sáng tạo & Portfolio",
        hint: "Đính kèm liên kết sản phẩm mẫu để AI định hình phong cách sáng tạo.",
        fields: [
          { id: "ctx_creative_portfolio", label: "Liên kết Portfolio / Kênh nội dung (URL)", placeholder: "Ví dụ: behance.net/profile, youtube.com/@channel, tiktok.com/@creator..." },
          { id: "ctx_creative_format", label: "Định dạng sản phẩm thế mạnh", placeholder: "Ví dụ: Video TikTok/Reels, thiết kế Design System Figma, bài viết Long-form..." }
        ]
      }
    },
    {
      id: "finance_banking_accounting",
      name: "Tài chính, Kế toán, Ngân hàng & Bảo hiểm",
      tag: "Tài chính",
      desc: "Kế toán tổng hợp, kiểm toán, lập mô hình tài chính, quản trị dòng tiền, tín dụng ngân hàng và phân tích đầu tư",
      backendJobFamily: "FINANCE_ACCOUNTING",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>`,
      roles: [
        "Financial Analyst",
        "Kế toán viên Tổng hợp",
        "Kế toán trưởng / Trưởng phòng Tài chính",
        "Chuyên viên Kiểm toán (Auditor)",
        "Chuyên viên Quan hệ Khách hàng Doanh nghiệp Ngân hàng",
        "Chuyên viên Thẩm định Rủi ro Tín dụng",
        "Chuyên viên Đầu tư Tài chính"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Tài chính & Kế toán",
        hint: "Xác định chuẩn mực kế toán và nghiệp vụ trọng tâm bạn muốn phỏng vấn.",
        fields: [
          { id: "ctx_fin_standards", label: "Chuẩn mực kế toán & Phần mềm", placeholder: "Ví dụ: VAS, IFRS, SAP ERP, MISA, FAST, Bravo..." },
          { id: "ctx_fin_specialty", label: "Nghiệp vụ tài chính trọng tâm", placeholder: "Ví dụ: Lập báo cáo lưu chuyển tiền tệ, quyết toán thuế TNDN, thẩm định hạn mức tín dụng..." }
        ]
      }
    },
    {
      id: "hr_training_people",
      name: "Nhân sự và đào tạo",
      tag: "Nhân sự",
      desc: "Tuyển dụng nhân tài, quản trị tiền lương & phúc lợi (C&B), đào tạo phát triển (L&D), và đối tác nhân sự HRBP",
      backendJobFamily: "HR_PEOPLE",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      roles: [
        "HR Recruiter",
        "Chuyên viên Tuyển dụng & Thu hút Nhân tài",
        "Chuyên viên Tiền lương & Phúc lợi (C&B)",
        "Chuyên viên Đào tạo & Phát triển (L&D)",
        "Đối tác Nhân sự (HRBP)",
        "Trưởng phòng Nhân sự (HR Manager)"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Quản trị Nhân sự",
        hint: "Bổ sung quy mô doanh nghiệp và các bài toán nhân sự thực tế bạn từng giải quyết.",
        fields: [
          { id: "ctx_hr_scope", label: "Mảng nhân sự chuyên sâu & Quy mô", placeholder: "Ví dụ: Tuyển dụng ngành IT, quản lý C&B quy mô 500+ nhân sự, xây dựng khung năng lực..." },
          { id: "ctx_hr_challenge", label: "Tình huống nhân sự muốn thử nghiệm", placeholder: "Ví dụ: Xử lý xung đột lao động, đàm phán ứng viên cấp cao, giữ chân nhân tài..." }
        ]
      }
    },
    {
      id: "education_research",
      name: "Giáo dục và nghiên cứu",
      tag: "Giáo dục",
      desc: "Giảng dạy học thuật, phát triển chương trình đào tạo, nghiên cứu khoa học và tư vấn giáo dục",
      backendJobFamily: "GENERAL_PROFESSIONAL",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      roles: [
        "Giảng viên Đại học / Cao đẳng",
        "Giáo viên Phổ thông / Trung tâm",
        "Chuyên viên Phát triển Chương trình (Curriculum Developer)",
        "Nghiên cứu viên Khoa học (Researcher)",
        "Chuyên viên Tư vấn Tuyển sinh & Du học"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Giáo dục & Nghiên cứu",
        hint: "Bổ sung bậc học hoặc lĩnh vực chuyên môn bạn giảng dạy / nghiên cứu.",
        fields: [
          { id: "ctx_edu_field", label: "Bộ môn / Lĩnh vực chuyên ngành", placeholder: "Ví dụ: Giảng dạy tiếng Anh IELTS, Toán ứng dụng, Khoa học dữ liệu, Phương pháp sư phạm..." },
          { id: "ctx_edu_methodology", label: "Phương pháp giảng dạy hoặc đề tài nghiên cứu", placeholder: "Ví dụ: Học qua dự án (PBL), ứng dụng EdTech trong lớp học, công bố bài báo..." }
        ]
      }
    },
    {
      id: "healthcare_pharma",
      name: "Y tế, dược và khoa học sự sống",
      tag: "Y tế",
      desc: "Khám chữa bệnh, điều dưỡng, dược lâm sàng, nghiên cứu sinh học, quản lý phòng khám và thiết bị y tế",
      backendJobFamily: "GENERAL_PROFESSIONAL",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
      roles: [
        "Bác sĩ Đa khoa / Chuyên khoa",
        "Dược sĩ Lâm sàng / Nhà thuốc",
        "Điều dưỡng viên / Kỹ thuật viên Y tế",
        "Trình dược viên / Chuyên viên Y tế Doanh nghiệp",
        "Chuyên viên Nghiên cứu Sinh học / Dược phẩm",
        "Kỹ sư Thiết bị Y tế (Biomedical Engineer)"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Y tế & Dược phẩm",
        hint: "Bổ sung chuyên khoa và môi trường y tế để các tình huống phỏng vấn chuẩn xác.",
        fields: [
          { id: "ctx_health_specialty", label: "Chuyên khoa / Lĩnh vực y tế", placeholder: "Ví dụ: Dược lý lâm sàng, nội khoa, chăm sóc hồi sức tích cực, thiết bị chẩn đoán hình ảnh..." },
          { id: "ctx_health_environment", label: "Môi trường công tác", placeholder: "Ví dụ: Bệnh viện tuyến đầu, phòng khám quốc tế, công ty sản xuất dược phẩm FDI..." }
        ]
      }
    },
    {
      id: "logistics_supplychain",
      name: "Logistics, chuỗi cung ứng và thu mua",
      tag: "Vận hành",
      desc: "Quản trị kho bãi (WMS), xuất nhập khẩu hải quan, thu mua quốc tế (Procurement) và điều phối giao nhận",
      backendJobFamily: "OPERATIONS_SUPPLY_CHAIN",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
      roles: [
        "Chuyên viên Xuất Nhập Khẩu (Import-Export)",
        "Chuyên viên Thu Mua (Procurement Specialist)",
        "Quản lý Kho vận & Phân phối (Warehouse Manager)",
        "Chuyên viên Hoạch định Chuỗi cung ứng (Supply Planner)",
        "Điều phối Vận tải & Logistics (Freight Forwarder)"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Chuỗi cung ứng & Kho vận",
        hint: "Cung cấp điều kiện thương mại và quy mô vận chuyển bạn quản trị.",
        fields: [
          { id: "ctx_log_terms", label: "Điều kiện Incoterms & Chứng từ thường dùng", placeholder: "Ví dụ: FOB, CIF, DDP, L/C, B/L, khai báo hải quan điện tử VNACCS..." },
          { id: "ctx_log_scale", label: "Quy mô kho bãi hoặc tuyến vận tải", placeholder: "Ví dụ: Kho ngoại quan 10.000m2, tuyến vận chuyển đường biển Á - Âu, quản lý WMS..." }
        ]
      }
    },
    {
      id: "hospitality_tourism_events",
      name: "Du lịch, khách sạn, nhà hàng và sự kiện",
      tag: "Dịch vụ",
      desc: "Quản lý khách sạn resort, điều hành tour, quản trị dịch vụ ẩm thực F&B và tổ chức sự kiện chuyên nghiệp",
      backendJobFamily: "CUSTOMER_SUCCESS",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      roles: [
        "Quản lý Khách sạn / Resort (Hotel Manager)",
        "Giám sát Tiền sảnh / Front Office Manager",
        "Quản lý Nhà hàng / Dịch vụ Ẩm thực (F&B Manager)",
        "Chuyên viên Điều hành Tour Du lịch (Tour Operator)",
        "Chuyên viên Tổ chức Sự kiện (Event Specialist)"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Du lịch & Nhà hàng Khách sạn",
        hint: "Làm rõ phân khúc dịch vụ và tiêu chuẩn phục vụ khách hàng của bạn.",
        fields: [
          { id: "ctx_hosp_tier", label: "Phân khúc khách hàng & Tiêu chuẩn", placeholder: "Ví dụ: Khách sạn 4-5 sao, khách quốc tế Âu - Mỹ, chuỗi F&B cao cấp..." },
          { id: "ctx_hosp_challenge", label: "Tình huống dịch vụ muốn giải quyết", placeholder: "Ví dụ: Xử lý khiếu nại khách hàng khó tính, quản lý chi phí food cost, sự cố sự kiện..." }
        ]
      }
    },
    {
      id: "legal_compliance_risk",
      name: "Pháp lý, compliance và quản trị rủi ro",
      tag: "Pháp lý",
      desc: "Pháp chế doanh nghiệp, rà soát hợp đồng kinh tế, tư vấn luật lao động/sở hữu trí tuệ và kiểm soát tuân thủ",
      backendJobFamily: "GENERAL_PROFESSIONAL",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      roles: [
        "Chuyên viên Pháp chế Doanh nghiệp (In-house Legal)",
        "Luật sư Tư vấn (Associate / Counsel)",
        "Chuyên viên Kiểm soát Tuân thủ (Compliance Officer)",
        "Chuyên viên Quản trị Rủi ro (Risk Manager)",
        "Chuyên viên Pháp lý Sở hữu Trí tuệ (IP Specialist)"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Pháp chế & Tuân thủ",
        hint: "Bổ sung lĩnh vực luật pháp hoặc khung quy định doanh nghiệp bạn phụ trách.",
        fields: [
          { id: "ctx_legal_scope", label: "Mảng luật & Hợp đồng trọng tâm", placeholder: "Ví dụ: Luật Doanh nghiệp, Hợp đồng thương mại quốc tế, M&A, Luật Lao động, GDPR/Dữ liệu..." },
          { id: "ctx_legal_challenge", label: "Thách thức pháp lý muốn xử lý", placeholder: "Ví dụ: Đàm phán điều khoản bồi thường thiệt hại, tranh chấp đối tác, tuân thủ AML..." }
        ]
      }
    },
    {
      id: "agriculture_environment_energy",
      name: "Nông nghiệp, môi trường và năng lượng",
      tag: "Năng lượng",
      desc: "Kỹ thuật canh tác công nghệ cao, quản lý tài nguyên môi trường, năng lượng tái tạo (điện gió, mặt trời) và ESG",
      backendJobFamily: "GENERAL_PROFESSIONAL",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
      roles: [
        "Kỹ sư Nông nghiệp Công nghệ cao",
        "Kỹ sư Môi trường & Xử lý Nước thải",
        "Kỹ sư Năng lượng Tái tạo (Solar / Wind)",
        "Chuyên viên Đánh giá Tác động Môi trường (EIA)",
        "Chuyên viên Bền vững & Báo cáo ESG"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Nông nghiệp & Môi trường",
        hint: "Bổ sung công nghệ canh tác hoặc tiêu chuẩn môi trường bạn làm việc.",
        fields: [
          { id: "ctx_env_tech", label: "Công nghệ / Tiêu chuẩn áp dụng", placeholder: "Ví dụ: Hệ thống tưới nhỏ giọt Israel, GlobalGAP, tiêu chuẩn xả thải QCVN, chuẩn ESG..." },
          { id: "ctx_env_project", label: "Quy mô dự án hoặc bài toán xử lý", placeholder: "Ví dụ: Nông trại 50ha, nhà máy xử lý 5000m3/ngày, trang trại điện mặt trời 50MWp..." }
        ]
      }
    },
    {
      id: "admin_office_support",
      name: "Hành chính và hỗ trợ văn phòng",
      tag: "Hành chính",
      desc: "Quản trị cơ sở vật chất văn phòng, thư ký ban giám đốc, trợ lý điều hành và quản lý tài liệu lưu trữ",
      backendJobFamily: "GENERAL_PROFESSIONAL",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      roles: [
        "Chuyên viên Hành chính Văn phòng",
        "Trợ lý Tổng Giám đốc / Trợ lý Điều hành (EA)",
        "Thư ký Ban Giám đốc (Executive Secretary)",
        "Quản lý Tòa nhà & Tiện ích Văn phòng (Office Manager)",
        "Chuyên viên Lưu trữ & Quản lý Tài liệu"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Quản trị Hành chính",
        hint: "Giúp người phỏng vấn đánh giá tác phong quản lý văn phòng và điều phối công việc.",
        fields: [
          { id: "ctx_admin_scope", label: "Phạm vi điều phối chính", placeholder: "Ví dụ: Quản lý ngân sách hành chính, tổ chức cuộc họp HĐQT, thủ tục visa công tác..." },
          { id: "ctx_admin_skills", label: "Kỹ năng tổ chức thế mạnh", placeholder: "Ví dụ: Quản lý nhà cung cấp văn phòng, sắp xếp lịch trình lãnh đạo, bảo mật thông tin..." }
        ]
      }
    },
    {
      id: "social_work_community",
      name: "Công tác xã hội và tổ chức cộng đồng",
      tag: "Cộng đồng",
      desc: "Điều phối dự án phi chính phủ (NGO), phát triển cộng đồng bền vững, công tác trợ giúp xã hội và vận động gây quỹ",
      backendJobFamily: "GENERAL_PROFESSIONAL",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
      roles: [
        "Điều phối viên Dự án Phi chính phủ (NGO Coordinator)",
        "Chuyên viên Công tác Xã hội",
        "Chuyên viên Phát triển Cộng đồng",
        "Chuyên viên Vận động Tài trợ & Gây quỹ (Fundraising)",
        "Cán bộ Quản lý Dự án Hỗ trợ Nhân đạo"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Hoạt động Cộng đồng & Xã hội",
        hint: "Làm rõ nhóm đối tượng thụ hưởng và quy mô can thiệp xã hội của bạn.",
        fields: [
          { id: "ctx_social_audience", label: "Đối tượng thụ hưởng & Mảng can thiệp", placeholder: "Ví dụ: Trẻ em có hoàn cảnh khó khăn, phát triển sinh kế phụ nữ nông thôn, y tế cộng đồng..." },
          { id: "ctx_social_donors", label: "Bên tài trợ hoặc phương pháp đánh giá", placeholder: "Ví dụ: USAID, Quỹ Châu Âu, báo cáo M&E, khảo sát nhu cầu cơ sở..." }
        ]
      }
    },
    {
      id: "safety_security_emergency",
      name: "An ninh, an toàn và ứng phó sự cố",
      tag: "An toàn",
      desc: "An toàn vệ sinh lao động (HSE), bảo vệ an ninh trật tự, giám sát an toàn thông tin cơ sở và phòng ngừa rủi ro",
      backendJobFamily: "GENERAL_PROFESSIONAL",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
      roles: [
        "Kỹ sư An toàn Lao động & Môi trường (HSE Engineer)",
        "Chuyên viên Quản lý An ninh Cơ sở",
        "Chuyên viên Ứng phó Sự cố Khẩn cấp",
        "Chuyên viên An toàn Phòng cháy Chữa cháy (PCCC)",
        "Chuyên viên Giám sát Tuân thủ An toàn Công trình"
      ],
      contextFields: {
        domainTitle: "Bổ trợ An toàn Lao động & HSE",
        hint: "Bổ sung quy chuẩn an toàn và loại hình môi trường làm việc đặc thù.",
        fields: [
          { id: "ctx_hse_standards", label: "Tiêu chuẩn HSE & Chứng chỉ áp dụng", placeholder: "Ví dụ: ISO 45001, OSHA, an toàn hóa chất, an toàn làm việc trên cao..." },
          { id: "ctx_hse_incident", label: "Kinh nghiệm điều tra & Ứng phó sự cố", placeholder: "Ví dụ: Đào tạo an toàn định kỳ, điều tra tai nạn lao động, diễn tập PCCC..." }
        ]
      }
    },
    {
      id: "other_professions",
      name: "Ngành nghề khác",
      tag: "Tự do",
      desc: "Nhập tự do bất kỳ chức danh nghề nghiệp nào theo đúng tin tuyển dụng bạn đang hướng tới",
      backendJobFamily: "GENERAL_PROFESSIONAL",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      roles: [
        "Chuyên viên chuyên môn",
        "Chuyên viên Tư vấn Độc lập",
        "Chuyên gia Quản trị Thay đổi",
        "Quản lý Vận hành Chi nhánh"
      ],
      contextFields: {
        domainTitle: "Bổ trợ Bối cảnh Ngành nghề Tự do",
        hint: "Mô tả ngắn gọn bối cảnh đặc thù để AI định hình câu hỏi khách quan nhất.",
        fields: [
          { id: "ctx_other_scope", label: "Đặc thù công việc bạn muốn nhấn mạnh", placeholder: "Ví dụ: Chuyên môn sâu về thẩm định đá quý, đấu thầu quốc tế, quản trị di sản văn hóa..." },
          { id: "ctx_other_goal", label: "Mục tiêu lớn nhất trong buổi phỏng vấn này", placeholder: "Ví dụ: Rèn luyện khả năng bảo vệ quan điểm chuyên môn trước hội đồng tuyển dụng..." }
        ]
      }
    }
  ];

  /**
   * Finds an industry group by ID (supports both 20-taxonomy and 11-primary sectors)
   */
  function getIndustryById(id) {
    if (!id) return null;
    const found = INDUSTRY_TAXONOMY.find(item => item.id === id);
    if (found) return found;
    const primary = PRIMARY_SECTORS.find(item => item.id === id);
    if (primary) {
      return INDUSTRY_TAXONOMY.find(item => item.id === primary.mappedTaxonomyId) || primary;
    }
    return null;
  }

  /**
   * Finds a primary sector by ID
   */
  function getPrimarySectorById(id) {
    if (!id) return null;
    return PRIMARY_SECTORS.find(item => item.id === id || item.mappedTaxonomyId === id) || null;
  }

  /**
   * Searches primary sector groups matching a query
   */
  function filterPrimarySectors(query) {
    if (!query || typeof query !== "string" || !query.trim()) {
      return PRIMARY_SECTORS;
    }
    const q = query.trim().toLowerCase();
    const normalizedQ = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    return PRIMARY_SECTORS.filter(item => {
      const name = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const desc = item.desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const tag = item.tag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const hasRole = item.roles.some(r => r.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQ));
      return name.includes(normalizedQ) || desc.includes(normalizedQ) || tag.includes(normalizedQ) || hasRole;
    });
  }

  /**
   * Matches an industry from free-text job title or industry name
   */
  function matchIndustryFromText(text) {
    if (!text || typeof text !== "string") return INDUSTRY_TAXONOMY[19]; // Default to other
    const raw = text.toLowerCase();
    const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // 1. IT / Software
    if (/software|developer|engineer|backend|frontend|fullstack|devops|cloud|data|qa|tester|mobile|ios|android|lap trinh|tri tue nhan tao|\bai\b|coder/.test(normalized)) {
      return getIndustryById("it_software");
    }
    // 2. Engineering & Manufacturing
    if (/co khi|dien tu|tu dong hoa|san xuat|mfg|plc|qa\/qc|quan doc|bao tri|mechanical|electrical|automation/.test(normalized)) {
      return getIndustryById("engineering_manufacturing");
    }
    // 3. Construction & Architecture
    if (/xay dung|kien truc|bat dong san|bds|qs|giam sat thi cong|architect|civil|real estate/.test(normalized)) {
      return getIndustryById("construction_architecture");
    }
    // 4. BA, Product, Project
    if (/business analyst|\bba\b|product manager|\bpm\b|project manager|scrum master|product owner|phan tich nghiep vu|quan ly san pham|quan ly du an/.test(normalized)) {
      return getIndustryById("ba_product_project");
    }
    // 5. Sales & Customer Success
    if (/sales|kinh doanh|ban hang|b2b|kam|account executive|phat trien thi truong|customer success|cskh|cham soc khach hang/.test(normalized)) {
      return getIndustryById("sales_business_customer");
    }
    // 6. Marketing & Ecommerce
    if (/marketing|digital marketing|performance|ads|seo|sem|growth|e-commerce|thuong mai dien tu|quang cao/.test(normalized)) {
      return getIndustryById("marketing_ecommerce");
    }
    // 7. PR & Journalism
    if (/truyen thong|pr|bao chi|phong vien|bien tap vien|quan he cong chung|corporate communications/.test(normalized)) {
      return getIndustryById("media_pr_journalism");
    }
    // 8. Content & Creative
    if (/content|copywriter|ui\/ux|graphic|designer|video|creator|art director|sang tao|thiet ke/.test(normalized)) {
      return getIndustryById("content_creative_design");
    }
    // 9. Finance & Accounting
    if (/tai chinh|ke toan|kiem toan|ngan hang|bao hiem|finance|financial|accountant|auditor|banking|tin dung|cfo|quan he khach hang/.test(normalized)) {
      return getIndustryById("finance_banking_accounting");
    }
    // 10. HR & Training
    if (/nhan su|tuyen dung|c&b|l&d|hrbp|human resources|\bhr\b|headhunt|dao tao/.test(normalized)) {
      return getIndustryById("hr_training_people");
    }
    // 11. Education & Research
    if (/giao duc|giang vien|giao vien|nghien cuu|curriculum|academic|sư pham|researcher/.test(normalized)) {
      return getIndustryById("education_research");
    }
    // 12. Healthcare & Pharma
    if (/y te|duoc|bac si|dieu duong|y si|trinh duoc|duoc si|clinic|hospital|biomedical/.test(normalized)) {
      return getIndustryById("healthcare_pharma");
    }
    // 13. Logistics & Supply Chain
    if (/logistics|chuoi cung ung|kho van|xuat nhap khau|thu mua|procurement|supply chain|forwarder|warehouse/.test(normalized)) {
      return getIndustryById("logistics_supplychain");
    }
    // 14. Hospitality & Tourism
    if (/du lich|khach san|nha hang|f&b|resort|hotel|event|su kien|tour/.test(normalized)) {
      return getIndustryById("hospitality_tourism_events");
    }
    // 15. Legal & Compliance
    if (/phap ly|phap che|luat|compliance|tuan thu|quan tri rui ro|legal|lawyer|risk/.test(normalized)) {
      return getIndustryById("legal_compliance_risk");
    }
    // 16. Agriculture & Environment
    if (/nong nghiep|moi truong|nang luong|solar|wind|esg|canh tac|xử lý nuoc/.test(normalized)) {
      return getIndustryById("agriculture_environment_energy");
    }
    // 17. Admin & Office
    if (/hanh chinh|van phong|tro ly|thu ky|executive assistant|office manager|receptionist/.test(normalized)) {
      return getIndustryById("admin_office_support");
    }
    // 18. Social & Community
    if (/cong tac xa hoi|phi chinh phu|ngo|cong dong|tu thien|fundraising|phat trien cong dong/.test(normalized)) {
      return getIndustryById("social_work_community");
    }
    // 19. Safety & Security
    if (/an ninh|an toan|hse|pccc|bao ve|ung pho su co|safety|security/.test(normalized)) {
      return getIndustryById("safety_security_emergency");
    }

    return getIndustryById("other_professions");
  }

  /**
   * Searches taxonomy groups matching a query
   */
  function filterTaxonomy(query) {
    if (!query || typeof query !== "string" || !query.trim()) {
      return INDUSTRY_TAXONOMY;
    }
    const q = query.trim().toLowerCase();
    const normalizedQ = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    return INDUSTRY_TAXONOMY.filter(item => {
      const name = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const desc = item.desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const hasRole = item.roles.some(r => r.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQ));
      return name.includes(normalizedQ) || desc.includes(normalizedQ) || hasRole;
    });
  }


  /**
   * Returns roles filtered by career level tier ('all', 'entry', 'professional', 'senior_lead')
   */
  function getRolesByLevel(sectorOrId, levelTier) {
    let sector = null;
    if (typeof sectorOrId === "string") {
      sector = getPrimarySectorById(sectorOrId) || getIndustryById(sectorOrId);
    } else if (sectorOrId && typeof sectorOrId === "object") {
      sector = sectorOrId;
    }
    if (!sector) return [];

    if (!levelTier || levelTier === "all") {
      return sector.roles || [];
    }

    if (sector.roleTiers && sector.roleTiers[levelTier]) {
      return sector.roleTiers[levelTier];
    }

    return sector.roles || [];
  }

  /**
   * Neutral guidance check: detects alignment between job title and selected seniority/experience.
   * Non-blocking, never downgrades or locks the user out.
   */
  function checkRoleExperienceAlignment(jobTitle, seniority, experienceYears) {
    if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) {
      return { isMisaligned: false, type: "aligned", message: "" };
    }

    const titleLower = jobTitle.trim().toLowerCase();
    const normalized = titleLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d");
    const sen = (seniority || "").toLowerCase();
    const exp = (experienceYears || "").toLowerCase();

    const isManagementRole = /(giam doc|director|truong phong|head of|truong ban|executive|c-level|ceo|cto|cfo|cmo|coo|quan ly cap cao|general manager|pho giam doc|pho chu tich|chu tich)/i.test(normalized);
    const isLeadRole = /(lead|truong nhom|quan ly|manager|quan doc|chi huy truong|chu tri)/i.test(normalized);
    const isEntryRole = /(thuc tap|intern|fresher|tro ly|hoc viec|junior|moi tot nghiep)/i.test(normalized);

    const isJuniorSeniority = sen === "junior" || exp === "under_1";
    const isSeniorLeadSeniority = sen === "senior" || sen === "lead" || exp === "5_to_8" || exp === "over_8";

    // Case 1: Management / Executive title with Junior / Entry level
    if (isManagementRole && isJuniorSeniority) {
      return {
        isMisaligned: true,
        type: "management_entry",
        noticeTitle: "Lưu ý về định hướng phỏng vấn cho vị trí quản lý",
        message: `Vị trí "${jobTitle}" thường đòi hỏi năng lực lãnh đạo, phân bổ nguồn lực và quản trị KPI. Với cấp bậc Mới vào nghề (Junior), người phỏng vấn sẽ tập trung vào tiềm năng quản trị và tư duy xử lý tình huống căn bản.`,
        suggestedSeniority: "Lead",
        suggestedSeniorityLabel: "Dẫn dắt / Quản lý (Lead)"
      };
    }

    // Case 2: Lead / Manager role with Junior level
    if (isLeadRole && !isManagementRole && isJuniorSeniority) {
      return {
        isMisaligned: true,
        type: "management_entry",
        noticeTitle: "Lưu ý về cấp bậc đảm nhận",
        message: `Chức danh "${jobTitle}" thường gắn với vai trò điều phối đội nhóm. Bạn vẫn có thể tiếp tục với cấp bậc Junior, hệ thống sẽ điều chỉnh câu hỏi sang hướng tiềm năng phát triển kỹ năng điều phối.`,
        suggestedSeniority: "Lead",
        suggestedSeniorityLabel: "Dẫn dắt / Quản lý (Lead)"
      };
    }

    // Case 3: Intern / Fresher title with Senior / Lead level
    if (isEntryRole && isSeniorLeadSeniority) {
      return {
        isMisaligned: true,
        type: "entry_senior",
        noticeTitle: "Lưu ý về mức độ thử thách",
        message: `Bạn đang chọn vị trí khởi đầu "${jobTitle}" kết hợp cùng cấp bậc Dày dạn (Senior / Lead). Người phỏng vấn sẽ mở rộng các câu hỏi thử thách giải quyết vấn đề ở mức độ chuyên sâu hơn thông thường.`,
        suggestedSeniority: "Junior",
        suggestedSeniorityLabel: "Mới vào nghề (Junior)"
      };
    }

    return {
      isMisaligned: false,
      type: "aligned",
      message: ""
    };
  }

  /**
   * Generates adaptive prompt framing context based on candidate career level.
   */
  function getAdaptiveLevelContext(seniority, experienceYears) {
    const s = (seniority || "Senior").toLowerCase();
    const exp = (experienceYears || "auto");

    let expLabel = "";
    if (exp === "under_1") expLabel = "Dưới 1 năm";
    else if (exp === "1_to_3") expLabel = "1 – 3 năm";
    else if (exp === "3_to_5") expLabel = "3 – 5 năm";
    else if (exp === "5_to_8") expLabel = "5 – 8 năm";
    else if (exp === "over_8") expLabel = "Trên 8 năm";

    let focus = "";
    if (s.includes("junior") || exp === "under_1") {
      focus = "Nền tảng kiến thức căn bản, phương pháp tư duy logic, khả năng học hỏi nhanh, tinh thần tiếp thu góp ý và tiềm năng phát triển.";
    } else if (s.includes("mid") || exp === "1_to_3" || exp === "3_to_5") {
      focus = "Khả năng thực thi độc lập, độ hoàn thiện sản phẩm công việc, kỹ năng xử lý vấn đề nghiệp vụ thực tế và tuân thủ quy chuẩn.";
    } else if (s.includes("lead") || exp === "over_8") {
      focus = "Tư duy chiến lược, năng lực dẫn dắt và đào tạo đội ngũ, quản trị mục tiêu (KPI/OKR), phân bổ nguồn lực và xử lý xung đột liên phòng ban.";
    } else {
      // Senior (default)
      focus = "Năng lực chuyên sâu, tư duy kiến trúc và tối ưu giải pháp, kỹ năng phân tích trade-off phức tạp, kinh nghiệm xử lý khủng hoảng và khả năng mentoring đồng nghiệp.";
    }

    let text = `[Định hướng cấp bậc - ${seniority || "Senior"}]: Trọng tâm đánh giá: ${focus}`;
    if (expLabel) {
      text += ` (Kinh nghiệm ghi nhận: ${expLabel})`;
    }
    return text;
  }

  return {
    TAXONOMY: INDUSTRY_TAXONOMY,
    PRIMARY_SECTORS: PRIMARY_SECTORS,
    getIndustryById,
    getPrimarySectorById,
    matchIndustryFromText,
    filterTaxonomy,
    filterPrimarySectors,
    getRolesByLevel,
    checkRoleExperienceAlignment,
    getAdaptiveLevelContext
  };
});
