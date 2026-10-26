/**
 * PREPMATE — CONTEXT-AWARE INTERVIEW PREPARATION & ETIQUETTE GUIDE
 * Work Item: WI-COACH-PRESENTATION-02
 *
 * Responsibilities:
 *   1. Context-aware Dress Code Guidance mapped to 11 industry sectors.
 *   2. Multi-Format Interview Adaptation (Onsite, Online, Phone, Unspecified).
 *   3. 4-Phase Practical Interview Etiquette Checklist (Pre-interview, Arrival & Waiting,
 *      In-interview, Wrap-up & Follow-up).
 *   4. Zero judgmental or invasive scoring — purely proactive reference advice.
 *   5. Seamless reuse of PrepMateTaxonomy (industry-taxonomy.js).
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    // Node.js environment
    const taxonomy = (function () {
      try {
        return require("./industry-taxonomy.js");
      } catch (e) {
        return null;
      }
    })();
    module.exports = factory(taxonomy);
  } else {
    // Browser environment
    root.PrepMatePreparationGuide = factory(root.PrepMateTaxonomy || null);
  }
})(typeof self !== "undefined" ? self : this, function (taxonomyModule) {
  "use strict";

  const INTERVIEW_FORMATS = {
    ONLINE: "online",
    ONSITE: "onsite",
    PHONE: "phone",
    UNSPECIFIED: "unspecified"
  };

  const FORMAT_LABELS = {
    [INTERVIEW_FORMATS.ONLINE]: "Phỏng vấn trực tuyến (Online)",
    [INTERVIEW_FORMATS.ONSITE]: "Phỏng vấn trực tiếp tại công ty (Onsite)",
    [INTERVIEW_FORMATS.PHONE]: "Phỏng vấn qua điện thoại (Phone Screening)",
    [INTERVIEW_FORMATS.UNSPECIFIED]: "Chưa xác định hình thức"
  };

  const ETHICAL_DISCLAIMER =
    "Gợi ý trang phục và tác phong mang tính tham khảo theo thông lệ chung của từng ngành, " +
    "không phải quy định bắt buộc cho tất cả doanh nghiệp. Không áp đặt theo giới tính, ngoại hình " +
    "hay điều kiện cá nhân. Ứng viên nên đối chiếu với hướng dẫn chính thức trong thư mời phỏng vấn.";

  /**
   * 11 Core Sector Dress Code Taxonomies
   */
  const DRESS_CODE_SECTORS = {
    tech_engineering: {
      id: "tech_engineering",
      name: "Công nghệ & Kỹ thuật",
      typicalStyle: "Smart Casual hoặc Trang phục lịch sự gọn gàng",
      summary: "Đa phần doanh nghiệp công nghệ chuộng sự thoải mái, năng động nhưng vẫn cần vẻ ngoài chỉn chu, tôn trọng người đối diện.",
      recommendations: [
        "Áo sơ mi đơn sắc hoặc áo polo có cổ nhã nhặn (ưu tiên màu trắng, xanh nhạt, xám hoặc pastel).",
        "Quần tây, quần chinos hoặc quần jeans sẫm màu trơn, sạch sẽ và không rách/sờn.",
        "Giày lười, giày tây hoặc giày sneaker tối màu gọn gàng, sạch sẽ."
      ],
      onlineTips: [
        "Tập trung trang phục chỉn chu phần thân trên; tránh áo có họa tiết sọc nhỏ gây hiệu ứng gợn sóng (moire) trên webcam.",
        "Điều chỉnh webcam ngang tầm mắt, kiểm tra ánh sáng chiếu đều phía trước mặt, tránh ngồi ngược sáng."
      ]
    },

    business_finance: {
      id: "business_finance",
      name: "Tài chính, Ngân hàng, Kế toán & Bảo hiểm",
      typicalStyle: "Business Formal hoặc Business Professional chỉn chu",
      summary: "Ngành tài chính và ngân hàng thường coi trọng tính chuẩn mực, kỷ luật và tác phong công sở truyền thống.",
      recommendations: [
        "Áo sơ mi tay dài trang nhã (trắng, xanh nhạt), kết hợp vest/blazer tối màu (đen, xanh navy, xám đậm).",
        "Quần âu phẳng phiu hoặc chân váy công sở dài ngang/qua gối.",
        "Giày tây hoặc giày cao gót đế vuông vừa phải, màu sắc trung tính; hạn chế phụ kiện lấp lánh hoặc trang sức rườm rà."
      ],
      onlineTips: [
        "Khoác thêm áo vest hoặc blazer công sở khi phỏng vấn online để thể hiện sự đĩnh đạc và đáng tin cậy.",
        "Chọn phông nền gọn gàng, tránh phông nền ảo bị nhòe tóc hoặc méo viền vai."
      ]
    },

    business_commerce: {
      id: "business_commerce",
      name: "Kinh tế, Kinh doanh & Bán hàng",
      typicalStyle: "Business Casual đến Professional lịch thiệp",
      summary: "Ưu tiên trang phục tạo ấn tượng cởi mở, tự tin và đáng tin cậy đối với đối tác hoặc khách hàng.",
      recommendations: [
        "Áo sơ mi có cổ hoặc áo blouse công sở lịch thiệp, có thể khoác nhẹ blazer thanh lịch.",
        "Quần âu hoặc chân váy bút chì nhã nhặn, tôn dáng lịch sự.",
        "Giày da hoặc giày búp bê công sở chỉn chu, sạch sẽ."
      ],
      onlineTips: [
        "Nụ cười tự nhiên và ánh mắt hướng về ống kính giúp tạo kết nối gần gũi như đang trò chuyện trực tiếp.",
        "Đảm bảo âm thanh rõ ràng, kiểm tra microphone trước khi vào phòng họp."
      ]
    },

    marketing_communications: {
      id: "marketing_communications",
      name: "Marketing, Truyền thông & Sáng tạo",
      typicalStyle: "Smart Casual phong cách, thanh lịch và sáng tạo",
      summary: "Ngành sáng tạo hoan nghênh cá tính riêng nhưng vẫn cần giữ chuẩn mực lịch sự và tính chuyên nghiệp.",
      recommendations: [
        "Áo sơ mi cách điệu, áo blazer phối hiện đại hoặc trang phục công sở có điểm nhấn tinh tế.",
        "Phối màu hài hòa, có thể dùng điểm nhấn nhẹ nhàng phản ánh gu thẩm mỹ cá nhân.",
        "Giày gọn gàng, sạch sẽ, phù hợp với tổng thể trang phục."
      ],
      onlineTips: [
        "Khung hình có ánh sáng tốt và phông nền sạch sẽ giúp làm nổi bật gương mặt và sự rạng rỡ.",
        "Chuẩn bị sẵn màn hình chia sẻ portfolio nếu cần trình chiếu chiến dịch hoặc sản phẩm truyền thông."
      ]
    },

    hr_administration: {
      id: "hr_administration",
      name: "Nhân sự & Hành chính",
      typicalStyle: "Business Casual chuẩn mực, thân thiện",
      summary: "Vai trò cầu nối tổ chức đòi hỏi hình ảnh chỉn chu, nhã nhặn, tạo cảm giác tin cậy và ấm áp.",
      recommendations: [
        "Áo sơ mi công sở hoặc áo kiểu thanh lịch có cổ.",
        "Quần tây ống đứng hoặc chân váy công sở màu sắc nhã nhặn (be, xanh đen, ghi xám).",
        "Đầu tóc gọn gàng, phụ kiện tối giản."
      ],
      onlineTips: [
        "Duy trì ánh mắt tự nhiên hướng về camera và cử chỉ gật đầu tiếp thu khi lắng nghe người phỏng vấn."
      ]
    },

    production_logistics: {
      id: "production_logistics",
      name: "Sản xuất, Vận hành & Logistics",
      typicalStyle: "Gọn gàng, năng động, tiện lợi di chuyển",
      summary: "Ưu tiên trang phục lịch sự, thực tế, dễ vận động nếu phỏng vấn có phần tham quan nhà xưởng/kho vận.",
      recommendations: [
        "Áo sơ mi cộc/dài tay hoặc áo polo dày dặn, màu sắc trung tính sạch sẽ.",
        "Quần tây hoặc quần vải dày dặn, đứng form.",
        "Giày bít mũi (closed-toe shoes) hoặc giày da êm chân, tránh giày cao gót nhọn nếu có tham quan xưởng."
      ],
      onlineTips: [
        "Chọn không gian yên tĩnh, cách ly tiếng ồn máy móc hoặc xe cộ nếu phỏng vấn từ xa."
      ]
    },

    construction_realestate: {
      id: "construction_realestate",
      name: "Xây dựng & Bất động sản",
      typicalStyle: "Chỉn chu, đáng tin cậy hoặc linh hoạt công trường",
      summary: "Vị trí văn phòng/bán hàng ưu tiên Business Formal; vị trí hiện trường ưu tiên gọn gàng, tôn trọng an toàn.",
      recommendations: [
        "Áo sơ mi có cổ phẳng phiu, quần âu tối màu lịch sự.",
        "Với mảng tư vấn bất động sản: khuyên dùng vest/blazer tạo sự uy tín với khách hàng.",
        "Giày tây hoặc giày da sạch sẽ; trang bị bảo hộ theo hướng dẫn nếu phỏng vấn tại công trường."
      ],
      onlineTips: [
        "Giữ góc máy ổn định, tránh rung lắc thiết bị khi trả lời các câu hỏi kỹ thuật hoặc thuyết trình."
      ]
    },

    education_training: {
      id: "education_training",
      name: "Giáo dục & Đào tạo",
      typicalStyle: "Trang nghiêm, mẫu mực, thanh lịch",
      summary: "Môi trường sư phạm coi trọng sự chuẩn mực, giản dị và tác phong gương mẫu.",
      recommendations: [
        "Áo sơ mi có cổ hoặc áo dài truyền thống (nếu nhà trường quy định).",
        "Quần âu tối màu hoặc chân váy công sở dài qua đầu gối.",
        "Trang điểm nhẹ nhàng, tóc tai buộc gọn gàng, tạo thiện cảm tri thức."
      ],
      onlineTips: [
        "Đảm bảo giọng nói rõ ràng, âm lượng vừa phải và ánh mắt ấm áp hướng về người dự thính."
      ]
    },

    healthcare_pharma: {
      id: "healthcare_pharma",
      name: "Y tế, Dược phẩm & Chăm sóc sức khỏe",
      typicalStyle: "Sạch sẽ, chuẩn mực y khoa, tuyệt đối trang nhã",
      summary: "Ngành y tế đặt tiêu chuẩn cao về sự sạch sẽ, an toàn, cẩn trọng và tính nhân văn.",
      recommendations: [
        "Trang phục công sở nhã nhặn, tuyệt đối sạch sẽ và phẳng phiu.",
        "Cắt tỉa móng tay gọn gàng, không dùng nước hoa nồng gắt hoặc trang sức sắc nhọn.",
        "Giày kín mũi, đế êm, tiện di chuyển nhanh."
      ],
      onlineTips: [
        "Phông nền phỏng vấn nên sáng sủa, ngăn nắp, thể hiện tính cẩn trọng của người làm nghề y."
      ]
    },

    hospitality_tourism: {
      id: "hospitality_tourism",
      name: "Dịch vụ, Du lịch & Khách sạn",
      typicalStyle: "Chuẩn mực dịch vụ cao cấp, rạng rỡ, lịch thiệp",
      summary: "Ngành hiếu khách đánh giá cao sự chỉn chu tuyệt đối về ngoại diện, nụ cười và tác phong đón tiếp.",
      recommendations: [
        "Bộ suit hoặc âu phục công sở chuẩn form, ủi phẳng phiu không nếp nhăn.",
        "Đầu tóc chải chuốt gọn gàng (búi lưới hoặc chải nếp), móng tay sạch sẽ.",
        "Tươi tắn, tác phong đứng ngồi chuẩn mực, thể hiện tinh thần hiếu khách (hospitality mindset)."
      ],
      onlineTips: [
        "Ánh sáng đầy đủ làm sáng gương mặt, luôn giữ nụ cười và ánh mắt rạng rỡ khi giao tiếp trực tuyến."
      ]
    },

    general_other: {
      id: "general_other",
      name: "Đa ngành nghề / Hướng dẫn an toàn",
      typicalStyle: "Smart Casual an toàn & lịch sự",
      summary: "Khi chưa biết rõ văn hóa công ty, lựa chọn trang phục gọn gàng, trung tính luôn là phương án an toàn nhất.",
      recommendations: [
        "Áo sơ mi có cổ màu sáng hoặc áo polo trơn lịch sự.",
        "Quần âu hoặc quần vải tối màu sạch sẽ, phẳng phiu.",
        "Giày bít mũi sạch sẽ; trang sức tối giản, không gây xao nhãng."
      ],
      onlineTips: [
        "Chọn phòng yên tĩnh, kiểm tra góc máy và thiết bị âm thanh trước giờ phỏng vấn ít nhất 15 phút."
      ]
    }
  };

  /**
   * Resolves industry string to standard sector ID
   */
  function resolveSector(industryIdOrText) {
    if (!industryIdOrText || typeof industryIdOrText !== "string") {
      return DRESS_CODE_SECTORS.general_other;
    }

    const key = industryIdOrText.trim().toLowerCase();
    if (DRESS_CODE_SECTORS[key]) return DRESS_CODE_SECTORS[key];

    // Try taxonomy module if available
    const tax = taxonomyModule || (typeof window !== "undefined" ? window.PrepMateTaxonomy : null);
    if (tax && typeof tax.getPrimarySectorById === "function") {
      const primary = tax.getPrimarySectorById(key);
      if (primary && DRESS_CODE_SECTORS[primary.id]) {
        return DRESS_CODE_SECTORS[primary.id];
      }
    }

    if (tax && typeof tax.matchIndustryFromText === "function") {
      const matched = tax.matchIndustryFromText(industryIdOrText);
      if (matched) {
        if (matched.id === "it_software") return DRESS_CODE_SECTORS.tech_engineering;
        if (matched.id === "finance_banking") return DRESS_CODE_SECTORS.business_finance;
        if (matched.id === "sales_business") return DRESS_CODE_SECTORS.business_commerce;
        if (matched.id === "marketing_media") return DRESS_CODE_SECTORS.marketing_communications;
        if (matched.id === "hr_admin") return DRESS_CODE_SECTORS.hr_administration;
        if (matched.id === "logistics_supply") return DRESS_CODE_SECTORS.production_logistics;
        if (matched.id === "construction_arch") return DRESS_CODE_SECTORS.construction_realestate;
        if (matched.id === "education_pedagogy") return DRESS_CODE_SECTORS.education_training;
        if (matched.id === "healthcare_medicine") return DRESS_CODE_SECTORS.healthcare_pharma;
        if (matched.id === "hospitality_tourism") return DRESS_CODE_SECTORS.hospitality_tourism;
      }
    }

    // Keyword heuristics
    if (/(công nghệ|software|it|lập trình|kỹ sư|developer|data|ai)/i.test(key)) return DRESS_CODE_SECTORS.tech_engineering;
    if (/(ngân hàng|tài chính|kế toán|kiểm toán|bảo hiểm|chứng khoán)/i.test(key)) return DRESS_CODE_SECTORS.business_finance;
    if (/(kinh doanh|bán hàng|sales|thương mại)/i.test(key)) return DRESS_CODE_SECTORS.business_commerce;
    if (/(marketing|truyền thông|quảng cáo|sáng tạo|content|design)/i.test(key)) return DRESS_CODE_SECTORS.marketing_communications;
    if (/(nhân sự|hành chính|tuyển dụng|hr)/i.test(key)) return DRESS_CODE_SECTORS.hr_administration;
    if (/(sản xuất|vận hành|logistics|kho vận|chuỗi cung ứng)/i.test(key)) return DRESS_CODE_SECTORS.production_logistics;
    if (/(xây dựng|bất động sản|kiến trúc)/i.test(key)) return DRESS_CODE_SECTORS.construction_realestate;
    if (/(giáo dục|đào tạo|giảng dạy|giáo viên)/i.test(key)) return DRESS_CODE_SECTORS.education_training;
    if (/(y tế|dược|bệnh viện|bác sĩ|điều dưỡng|chăm sóc sức khỏe)/i.test(key)) return DRESS_CODE_SECTORS.healthcare_pharma;
    if (/(du lịch|khách sạn|nhà hàng|dịch vụ)/i.test(key)) return DRESS_CODE_SECTORS.hospitality_tourism;

    return DRESS_CODE_SECTORS.general_other;
  }

  /**
   * Generates Dress Code Guide for given industry and format
   */
  function getDressCodeGuide(industryInput, format = INTERVIEW_FORMATS.UNSPECIFIED, options = {}) {
    const sector = resolveSector(industryInput);
    const validFormat = Object.values(INTERVIEW_FORMATS).includes(format) ? format : INTERVIEW_FORMATS.UNSPECIFIED;
    const formatLabel = FORMAT_LABELS[validFormat] || FORMAT_LABELS[INTERVIEW_FORMATS.UNSPECIFIED];

    const companyName = options.companyName ? String(options.companyName).trim() : "";
    const companyNotice = companyName
      ? `Doanh nghiệp ứng tuyển: ${companyName}. PrepMate tôn trọng sự đa dạng văn hóa và không đưa ra quy định giả định riêng cho từng công ty.`
      : null;

    let formatSpecificAdvice = [];
    if (validFormat === INTERVIEW_FORMATS.ONLINE) {
      formatSpecificAdvice = [
        "Phỏng vấn trực tuyến: Chú trọng trang phục chỉn chu phần thân trên, chọn màu tương phản nhẹ với phông nền phòng.",
        "Tránh áo có hoa văn kẻ sọc li ti để không gây hiệu ứng răng cưa trên webcam.",
        "Khuyên mặc đầy đủ trang phục lịch sự cả phần thân dưới để luôn tự tin khi cần đứng dậy chỉnh góc máy."
      ];
    } else if (validFormat === INTERVIEW_FORMATS.ONSITE) {
      formatSpecificAdvice = [
        "Phỏng vấn trực tiếp: Quần âu/chân váy phẳng phiu và giày da/giày công sở sạch sẽ, êm chân.",
        "Ủi phẳng trang phục từ tối hôm trước để tránh vội vã vào buổi sáng."
      ];
    } else if (validFormat === INTERVIEW_FORMATS.PHONE) {
      formatSpecificAdvice = [
        "Phỏng vấn qua điện thoại: Chọn trang phục thoải mái tại nhà giúp bạn thư giãn và điều tiết giọng nói ấm áp.",
        "Chuẩn bị sẵn cốc nước lọc, bút và sổ tay ghi chép ngay trước mặt."
      ];
    } else {
      formatSpecificAdvice = [
        "Nếu chưa rõ hình thức phỏng vấn, hãy chuẩn bị trước trang phục công sở nhã nhặn (sơ mi, quần tây/váy thanh lịch)."
      ];
    }

    return {
      sectorId: sector.id,
      sectorName: sector.name,
      typicalStyle: sector.typicalStyle,
      summary: sector.summary,
      recommendations: sector.recommendations,
      formatSpecificAdvice,
      onlineTips: sector.onlineTips,
      format: validFormat,
      formatLabel,
      companyNotice,
      disclaimer: ETHICAL_DISCLAIMER
    };
  }

  /**
   * Generates the 4-Phase Interview Etiquette Checklist
   */
  function getEtiquetteChecklist(format = INTERVIEW_FORMATS.UNSPECIFIED, options = {}) {
    const validFormat = Object.values(INTERVIEW_FORMATS).includes(format) ? format : INTERVIEW_FORMATS.UNSPECIFIED;
    const company = options.companyName ? String(options.companyName).trim() : "";
    const position = options.jobTitle ? String(options.jobTitle).trim() : "vị trí ứng tuyển";

    // Phase A: Trước buổi phỏng vấn
    const phaseAItems = [
      {
        id: "chk-etiquette-a1",
        phase: "PhaseA",
        phaseName: "Giai đoạn A: Trước buổi phỏng vấn",
        title: "Xác nhận thời gian, địa điểm hoặc liên kết phòng họp trực tuyến",
        subtitle: validFormat === INTERVIEW_FORMATS.ONLINE
          ? "Kiểm tra kỹ link họp (Google Meet, Zoom, Teams), mật khẩu và tài khoản đăng nhập."
          : "Lưu lại chính xác địa chỉ tòa nhà, số tầng, phòng họp và số điện thoại người liên hệ.",
        timing: "Trước 24 - 48 giờ"
      },
      {
        id: "chk-etiquette-a2",
        phase: "PhaseA",
        phaseName: "Giai đoạn A: Trước buổi phỏng vấn",
        title: "Đọc lại mô tả công việc (JD), CV đã nộp và thông tin cốt lõi về doanh nghiệp",
        subtitle: company ? `Nắm rõ định hướng hoạt động, sản phẩm nổi bật của ${company}.` : "Ghi chú sẵn 2-3 thành tựu nổi bật trong CV để chia sẻ.",
        timing: "Trước 1 ngày"
      },
      {
        id: "chk-etiquette-a3",
        phase: "PhaseA",
        phaseName: "Giai đoạn A: Trước buổi phỏng vấn",
        title: validFormat === INTERVIEW_FORMATS.ONLINE
          ? "Kiểm tra kỹ thuật: microphone, webcam, đường truyền mạng và sạc pin thiết bị"
          : "Chuẩn bị hồ sơ giấy: 2-3 bản in CV sạch đẹp, sổ tay ghi chép và bút ký",
        subtitle: validFormat === INTERVIEW_FORMATS.ONLINE
          ? "Thực hiện một cuộc gọi thử để kiểm tra độ rõ của âm thanh và góc camera ngang tầm mắt."
          : "Đựng tài liệu trong bìa hồ sơ phẳng phiu, tránh để nhàu nát.",
        timing: "Trước 1 ngày"
      },
      {
        id: "chk-etiquette-a4",
        phase: "PhaseA",
        phaseName: "Giai đoạn A: Trước buổi phỏng vấn",
        title: validFormat === INTERVIEW_FORMATS.ONLINE
          ? "Sắp xếp không gian phỏng vấn yên tĩnh, đủ sáng và gọn gàng"
          : "Lên kế hoạch lộ trình di chuyển và trừ hao tắc đường",
        subtitle: validFormat === INTERVIEW_FORMATS.ONLINE
          ? "Hạn chế tối đa tiếng ồn xung quanh và thông báo cho người thân để không bị gián đoạn."
          : "Dự kiến có mặt trước giờ hẹn từ 10 - 15 phút (tránh đến quá sớm >30 phút hoặc trễ giờ).",
        timing: "Trước giờ phỏng vấn"
      }
    ];

    // Phase B: Khi đến nơi & Phòng chờ (hoặc Đăng nhập phòng họp)
    const phaseBItems = validFormat === INTERVIEW_FORMATS.ONLINE ? [
      {
        id: "chk-etiquette-b1",
        phase: "PhaseB",
        phaseName: "Giai đoạn B: Đăng nhập phòng họp trực tuyến",
        title: "Đăng nhập phòng họp sớm 5-7 phút với tên hiển thị chuyên nghiệp",
        subtitle: "Đặt tên hiển thị dạng 'Họ Tên - Vị trí ứng tuyển', tránh dùng biệt danh hoặc tên thiết bị.",
        timing: "Trước giờ hẹn 5 - 7 phút"
      },
      {
        id: "chk-etiquette-b2",
        phase: "PhaseB",
        phaseName: "Giai đoạn B: Đăng nhập phòng họp trực tuyến",
        title: "Mở sẵn tài liệu, đóng các tab trình duyệt và ứng dụng mạng xã hội gây xao nhãng",
        subtitle: "Tắt thông báo Zalo, Messenger, Slack hoặc email để không phát ra âm thanh báo động.",
        timing: "Trước giờ hẹn 5 phút"
      },
      {
        id: "chk-etiquette-b3",
        phase: "PhaseB",
        phaseName: "Giai đoạn B: Đăng nhập phòng họp trực tuyến",
        title: "Kiểm tra trạng thái micro và camera khi vào phòng chờ",
        subtitle: "Chủ động tắt micro khi ở phòng chờ đông người, bật lại ngay khi bắt đầu chào hỏi.",
        timing: "Khi vào phòng họp"
      }
    ] : [
      {
        id: "chk-etiquette-b1",
        phase: "PhaseB",
        phaseName: "Giai đoạn B: Khi đến địa điểm & Phòng chờ",
        title: "Chào hỏi lịch sự với nhân viên an ninh hoặc lễ tân tại sảnh tiếp đón",
        subtitle: `Mẫu câu tự nhiên: "Chào anh/chị, tôi là [Họ Tên], hôm nay tôi có lịch hẹn phỏng vấn ${position} lúc [Giờ]. Nhờ anh/chị hướng dẫn tôi đến khu vực tiếp đón."`,
        timing: "Khi vừa đến nơi"
      },
      {
        id: "chk-etiquette-b2",
        phase: "PhaseB",
        phaseName: "Giai đoạn B: Khi đến địa điểm & Phòng chờ",
        title: "Nêu rõ thông tin lịch hẹn và tuân thủ quy trình đăng ký khách ra vào",
        subtitle: "Xuất trình CCCD/giấy tờ nếu tòa nhà yêu cầu; đeo thẻ khách đúng quy định.",
        timing: "Tại quầy lễ tân"
      },
      {
        id: "chk-etiquette-b3",
        phase: "PhaseB",
        phaseName: "Giai đoạn B: Khi đến địa điểm & Phòng chờ",
        title: "Giữ tác phong lịch thiệp, tôn trọng với mọi nhân viên trong công ty",
        subtitle: "Thái độ với bảo vệ, lễ tân, nhân viên vệ sinh cũng phản ánh văn hóa và tính chuyên nghiệp của bạn.",
        timing: "Xuyên suốt thời gian ở công ty"
      },
      {
        id: "chk-etiquette-b4",
        phase: "PhaseB",
        phaseName: "Giai đoạn B: Khi đến địa điểm & Phòng chờ",
        title: "Ngồi chờ tại đúng vị trí hướng dẫn, chuyển điện thoại sang chế độ im lặng",
        subtitle: "Hạn chế xem video có âm thanh hoặc nói chuyện điện thoại lớn tiếng ở phòng chờ.",
        timing: "Trong phòng chờ"
      }
    ];

    // Phase C: Trong buổi phỏng vấn
    const phaseCItems = [
      {
        id: "chk-etiquette-c1",
        phase: "PhaseC",
        phaseName: "Giai đoạn C: Trong buổi phỏng vấn",
        title: validFormat === INTERVIEW_FORMATS.ONLINE
          ? "Chào hỏi nồng nhiệt và kiểm tra tín hiệu âm thanh khi người phỏng vấn xuất hiện"
          : "Gõ cửa nhẹ (2-3 tiếng) trước khi vào; chào hỏi người phỏng vấn với nụ cười tự nhiên",
        subtitle: validFormat === INTERVIEW_FORMATS.ONLINE
          ? "Mẫu câu: 'Em chào anh/chị, anh/chị có nghe rõ âm thanh phía em không ạ?'"
          : "Chờ người phỏng vấn mời ngồi trước khi kéo ghế ngồi xuống.",
        timing: "Đầu buổi phỏng vấn"
      },
      {
        id: "chk-etiquette-c2",
        phase: "PhaseC",
        phaseName: "Giai đoạn C: Trong buổi phỏng vấn",
        title: "Tôn trọng cử chỉ chào hỏi: chỉ bắt tay khi đối phương chủ động đưa tay",
        subtitle: "Bắt tay vừa phải, dứt khoát; không bắt buộc nếu người phỏng vấn chỉ gật đầu chào.",
        timing: "Khi gặp mặt"
      },
      {
        id: "chk-etiquette-c3",
        phase: "PhaseC",
        phaseName: "Giai đoạn C: Trong buổi phỏng vấn",
        title: "Lắng nghe trọn vẹn câu hỏi; hỏi lại lịch sự khi cần làm rõ yêu cầu",
        subtitle: "Không vội ngắt lời; có thể xin 2-3 giây suy nghĩ để câu trả lời có cấu trúc mạch lạc.",
        timing: "Trong khi trao đổi"
      },
      {
        id: "chk-etiquette-c4",
        phase: "PhaseC",
        phaseName: "Giai đoạn C: Trong buổi phỏng vấn",
        title: "Trả lời có cấu trúc và dẫn chứng cụ thể (theo mô hình STAR)",
        subtitle: "Nêu rõ bối cảnh, nhiệm vụ, hành động thực tế bạn đã làm và kết quả đo lường được.",
        timing: "Trả lời câu hỏi năng lực"
      },
      {
        id: "chk-etiquette-c5",
        phase: "PhaseC",
        phaseName: "Giai đoạn C: Trong buổi phỏng vấn",
        title: "Duy trì ánh mắt tự nhiên (Eye contact), thỉnh thoảng gật đầu tiếp thu",
        subtitle: "Nhìn tự nhiên vào mắt/gương mặt người phỏng vấn (hoặc camera); không bắt buộc phải nhìn chằm chằm liên tục.",
        timing: "Xuyên suốt cuộc trò chuyện"
      },
      {
        id: "chk-etiquette-c6",
        phase: "PhaseC",
        phaseName: "Giai đoạn C: Trong buổi phỏng vấn",
        title: "Chủ động đặt 1-2 câu hỏi sâu sắc về công việc, văn hóa nhóm hoặc mục tiêu dự án",
        subtitle: "Hỏi về thử thách lớn nhất của vị trí hoặc kỳ vọng trong 3 tháng đầu giúp thể hiện sự nghiêm túc và chủ động.",
        timing: "Cuối buổi phỏng vấn"
      }
    ];

    // Phase D: Kết thúc & Sau phỏng vấn
    const phaseDItems = [
      {
        id: "chk-etiquette-d1",
        phase: "PhaseD",
        phaseName: "Giai đoạn D: Kết thúc & Sau phỏng vấn",
        title: "Cảm ơn người phỏng vấn vì thời gian và cơ hội trao đổi cởi mở",
        subtitle: "Bày tỏ ngắn gọn sự hào hứng đối với vị trí và cơ hội đóng góp cho tổ chức.",
        timing: "Khi kết thúc phỏng vấn"
      },
      {
        id: "chk-etiquette-d2",
        phase: "PhaseD",
        phaseName: "Giai đoạn D: Kết thúc & Sau phỏng vấn",
        title: "Hỏi thăm lịch thiệp về bước tiếp theo và khung thời gian phản hồi kết quả",
        subtitle: "Giúp bạn chủ động kế hoạch công việc mà không tạo cảm giác thúc ép.",
        timing: "Trước khi rời phòng"
      },
      {
        id: "chk-etiquette-d3",
        phase: "PhaseD",
        phaseName: "Giai đoạn D: Kết thúc & Sau phỏng vấn",
        title: validFormat === INTERVIEW_FORMATS.ONLINE
          ? "Chờ người phỏng vấn chào và rời phòng trước, hoặc thoát phòng họp lịch sự"
          : "Thu dọn tài liệu, xếp lại ghế ngay ngắn và chào tạm biệt lễ tân khi ra về",
        subtitle: "Giữ tác phong chỉn chu cho đến khi bước ra khỏi tòa nhà công ty.",
        timing: "Khi ra về"
      },
      {
        id: "chk-etiquette-d4",
        phase: "PhaseD",
        phaseName: "Giai đoạn D: Kết thúc & Sau phỏng vấn",
        title: "Cân nhắc gửi email cảm ơn chân thành trong vòng 24 giờ sau buổi phỏng vấn",
        subtitle: "Thư cảm ơn ngắn gọn, nhắc lại 1 điểm tâm đắc trong cuộc trò chuyện giúp tạo ấn tượng tích cực và chuyên nghiệp.",
        timing: "Trong vòng 24 giờ sau phỏng vấn"
      }
    ];

    return {
      format: validFormat,
      formatLabel: FORMAT_LABELS[validFormat] || FORMAT_LABELS[INTERVIEW_FORMATS.UNSPECIFIED],
      allPhases: [
        { key: "PhaseA", name: "Giai đoạn A: Trước buổi phỏng vấn", items: phaseAItems },
        { key: "PhaseB", name: validFormat === INTERVIEW_FORMATS.ONLINE ? "Giai đoạn B: Chuẩn bị phòng họp trực tuyến" : "Giai đoạn B: Khi đến nơi & Phòng chờ", items: phaseBItems },
        { key: "PhaseC", name: "Giai đoạn C: Trong buổi phỏng vấn", items: phaseCItems },
        { key: "PhaseD", name: "Giai đoạn D: Kết thúc & Sau phỏng vấn", items: phaseDItems }
      ],
      flatItems: [...phaseAItems, ...phaseBItems, ...phaseCItems, ...phaseDItems]
    };
  }

  const PrepMatePreparationGuide = {
    INTERVIEW_FORMATS,
    FORMAT_LABELS,
    ETHICAL_DISCLAIMER,
    DRESS_CODE_SECTORS,
    resolveSector,
    getDressCodeGuide,
    getEtiquetteChecklist
  };

  return PrepMatePreparationGuide;
});
