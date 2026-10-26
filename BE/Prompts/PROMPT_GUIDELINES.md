# PrepMate Prompt Engineering & Architecture Guidelines

## 1. Tổng quan kiến trúc (Architectural Overview)

PrepMate sử dụng kiến trúc **Single AI Gateway** với alias trung tâm `PrepMate`. Toàn bộ các prompt nghiệp vụ trong hệ thống được cấu trúc hóa theo kiến trúc phân tầng (modular domain-driven prompt architecture), tách biệt hoàn toàn giữa:
1. **Lớp vận chuyển & Gateway (Transport & Gateway)**: `GeminiService.cs`, `AIRouter.cs` chịu trách nhiệm cấu hình endpoint, retry, fallback và bảo mật token. Không chứa prompt nghiệp vụ.
2. **Lớp Prompt Nghiệp vụ (Domain Prompt Layer)**: Đặt tập trung trong `BE/Prompts/` theo từng domain độc lập (`Career`, `Company`, `Context`, `Interview`, `Knowledge`, `Reports`).
3. **Lớp Chính sách Dùng chung (Shared Policies)**: `BE/Prompts/Shared/` đảm bảo tính nhất quán về ngôn ngữ, ranh giới dữ liệu không tin cậy, chuẩn mực grounding và hợp đồng JSON đầu ra.
4. **Lớp Dịch vụ Nghiệp vụ (Business Services)**: Gọi các prompt builder tĩnh từ domain prompt tương ứng, truyền dữ liệu thực tế và nhận kết quả từ AI Gateway. Không xây dựng prompt inline bằng chuỗi ghép nối rải rác.

```
BE/Prompts/
├── Shared/
│   ├── PromptLanguagePolicy.cs      # Quy chuẩn ngôn ngữ (vi-VN mặc định, en-US khi yêu cầu)
│   ├── PromptGroundingPolicy.cs     # Zero-hallucination, phân định Fact vs Claim vs Inference
│   ├── PromptContextBoundary.cs     # Ranh giới phân tách dữ liệu người dùng/JD/CV <<<TAG>>>
│   └── PromptOutputPolicy.cs        # Ép chuẩn Strict JSON Only, chống bọc markdown code fences
├── Career/
│   ├── CvAnalysisPrompt.cs          # Phân tích CV ứng viên
│   ├── JobRecommendationPrompt.cs   # Gợi ý việc làm theo CV/kỹ năng
│   └── CareerRoadmapPrompt.cs       # Lập lộ trình phát triển nghề nghiệp
├── Company/
│   └── CompanyIntelligencePrompt.cs # Trích xuất thông tin & suy luận văn hóa công ty
├── Context/
│   └── InterviewContextPrompt.cs    # Tổng hợp toàn bộ context phỏng vấn
├── Interview/
│   ├── QuestionGenerationPrompt.cs  # Sinh câu hỏi phỏng vấn chuyên môn & tình huống (SSOT)
│   ├── QuestionPrompt.cs            # Facade tương thích ngược cho QuestionGenerationPrompt
│   ├── IntroductionPrompt.cs        # Chào đầu và đánh giá màn tự giới thiệu
│   ├── AnalysisPrompt.cs            # Phân tích câu trả lời theo tiêu chí
│   ├── BehavioralPrompt.cs          # Đánh giá câu hỏi hành vi theo khung STAR
│   ├── SituationalPrompt.cs         # Đánh giá câu hỏi xử lý tình huống thực tế
│   ├── InterviewerIntelligencePrompt.cs # Tinh chỉnh câu hỏi tự nhiên theo phong cách phỏng vấn viên
│   ├── CandidateQuestionPrompt.cs   # Trả lời câu hỏi ứng viên hỏi ngược lại nhà tuyển dụng
│   ├── ClosingPrompt.cs             # Lời chào kết thúc & phân tích vòng phỏng vấn
│   └── LegacyQuestionPrompt.cs      # Hỗ trợ flow legacy phỏng vấn
├── Knowledge/
│   ├── BlueprintPrompt.cs           # Sinh khung câu hỏi phỏng vấn đa ngành
│   └── BlueprintEnrichmentPrompt.cs # Làm giàu và đào sâu tiêu chí đánh giá ngành
├── Reports/
│   └── ReportPrompt.cs              # Báo cáo đánh giá tổng kết, thang điểm 100, minh chứng
└── PROMPT_GUIDELINES.md             # Tài liệu chuẩn hóa kiến trúc prompt
```

---

## 2. Các nguyên tắc thiết kế cốt lõi (Core Principles)

### 2.1. Độc lập Ngành nghề & Triệt tiêu Few-Shot Bias (Cross-Industry Integrity)
- **Tuyệt đối không hardcode thông số kỹ thuật đặc thù IT** (như Redis, Kafka, Microservices, 10,000 req/s, Docker) vào các hướng dẫn chung.
- Khi cần ví dụ minh họa (few-shot), phải sử dụng các vị trí đa dạng (Tài chính - Kế toán, Nhân sự, Marketing, Quản lý chuỗi cung ứng, Sales) hoặc sử dụng các biến số hình thức `[Lĩnh vực] - [Chỉ số]`.
- Giữ vững tính thích ứng: AI phải bám sát JD và CV của ứng viên thay vì tự động suy diễn sang phần mềm hay lập trình.

### 2.2. Phân tách Ranh giới Ngữ cảnh (Context Boundaries & Injection Defense)
- Dữ liệu do người dùng nhập vào (CV, câu trả lời, câu hỏi ứng viên) và dữ liệu bên ngoài (JD, mô tả công ty) là **Untrusted Context**.
- Mọi dữ liệu không tin cậy phải được bọc trong các thẻ ranh giới rõ ràng thông qua `PromptContextBoundary.Wrap(tag, content)`.
  ```csharp
  // Ví dụ:
  var jdSection = PromptContextBoundary.Wrap("JOB_DESCRIPTION", jdText);
  var cvSection = PromptContextBoundary.Wrap("CANDIDATE_CV", cvText);
  ```
- Thẻ ranh giới tự động làm sạch các thẻ đóng giả mạo nhằm ngăn chặn kỹ thuật Prompt Injection.

### 2.3. Quy chuẩn Ngôn ngữ (Language Consistency Policy)
- Sử dụng `PromptLanguagePolicy.GetInstruction(language)`:
  - Mặc định (`vi-VN` hoặc tiếng Việt): Hướng dẫn tĩnh, giải thích, nhận xét, câu hỏi phỏng vấn bằng tiếng Việt chuyên nghiệp, tự nhiên. Giữ nguyên thuật ngữ kỹ thuật chuyên ngành chuẩn quốc tế (ví dụ: Cash Flow, EBITDA, SEO, Conversion Rate, CI/CD, Microservices).
  - Khi `language` là `en-US` hoặc `en`: Toàn bộ câu hỏi, nhận xét và phân tích được xuất bằng tiếng Anh chuyên nghiệp.
- Không trộn lẫn câu tiếng Anh và tiếng Việt trong cùng một câu một cách gượng gạo (không code-switching tùy tiện).

### 2.4. Tính xác thực & Chống ảo giác (Grounding & Fact Separation)
- Tuân thủ `PromptGroundingPolicy`:
  - **Sự thật (Fact)**: Chỉ công nhận những thông tin được ghi rõ ràng trong JD/CV hoặc câu trả lời của ứng viên.
  - **Tuyên bố của ứng viên (Claim)**: Ghi nhận dưới dạng lời tự khai, cần kiểm chứng thực tế qua câu hỏi đào sâu.
  - **Suy luận (Inference)**: Phải được đánh dấu rõ là suy đoán dựa trên ngữ cảnh, không được khẳng định như một sự thật hiển nhiên.
  - Tuyệt đối không tự bịa đặt số năm kinh nghiệm, kỹ năng, dự án hoặc thành tích nếu không có trong dữ liệu cung cấp.

### 2.5. Hợp đồng JSON Nghiêm ngặt (Strict JSON Output Contract)
- Mọi phản hồi dạng có cấu trúc phải áp dụng `PromptOutputPolicy.GetJsonContract(schema)` hoặc `PromptOutputPolicy.StrictJsonOnly`.
- **Cấm markdown fences**: Tuyệt đối không bao bọc kết quả trong ` ```json ` hoặc ` ``` `. Trả về trực tiếp chuỗi JSON thuần để bảo đảm khả năng deserialize của backend.
- Giữ nguyên 100% tên trường (case sensitivity: camelCase hoặc PascalCase theo đúng DTO hiện hữu của backend).

---

## 3. Quy trình Thêm hoặc Sửa Prompt (Workflow for New/Modified Prompts)

Khi cần phát triển hoặc nâng cấp một prompt:
1. **Xác định Domain phù hợp**: Chọn hoặc tạo file trong thư mục `BE/Prompts/<Domain>/`.
2. **Khai báo class tĩnh và phương thức Build**:
   ```csharp
   namespace backend.Prompts.<Domain>
   {
       public static class <Feature>Prompt
       {
           public static string Build(<Parameters>)
           {
               // 1. Chuẩn bị ngôn ngữ
               var langPolicy = PromptLanguagePolicy.GetInstruction(language);
               
               // 2. Bọc ngữ cảnh bằng ranh giới an toàn
               var context = PromptContextBoundary.Wrap("LABEL", untrustedInput);
               
               // 3. Khai báo schema JSON
               var jsonContract = PromptOutputPolicy.GetJsonContract(schemaDescription);
               
               // 4. Ghép nối prompt hoàn chỉnh
               return $$"""
   ...
   """;
           }
       }
   }
   ```
3. **Gọi từ Business Service**:
   Thay thế mọi chuỗi inline trong Service bằng lệnh gọi `FeaturePrompt.Build(...)`.
4. **Kiểm tra biên dịch & Hợp đồng**:
   Chạy `dotnet build BE/backend.csproj` và các bài kiểm thử hồi quy `node tests/run-all.js`.
5. **Kiểm tra Zero Few-Shot Leakage**:
   Kiểm tra prompt đối với ít nhất 5 ngành nghề: IT, Marketing, Tài chính - Kế toán, Nhân sự (HR), Phân tích nghiệp vụ (BA).
