using System;
using backend.Models;
using backend.Prompts.Shared;

namespace backend.Prompts.Reports
{
    /// <summary>
    /// Comprehensive interview evaluation report prompt.
    /// Synthesizes verified evidence from conversation transcript, evaluates criteria,
    /// and provides constructive feedback grounded strictly in candidate demonstrations.
    /// </summary>
    public static class ReportPrompt
    {
        public static string Build(
            string jobTitle,
            string langInstruction,
            string qaTranscript)
        {
            var schema = """
{
  "overallScore": 75,
  "techScore": 75,
  "commScore": 80,
  "softScore": 70,
  "starScore": 75,
  "criteria": {
    "technicalKnowledge": "Chưa tốt | Tốt | Xuất sắc",
    "communication": "Chưa tốt | Tốt | Xuất sắc",
    "problemSolving": "Chưa tốt | Tốt | Xuất sắc",
    "attitude": "Chưa tốt | Tốt | Xuất sắc"
  },
  "strengths": "Điểm mạnh nổi bật có minh chứng từ câu trả lời",
  "improvements": "Điểm cần cải thiện dựa trên các câu trả lời chưa trọn vẹn",
  "suggestion": "Lời khuyên phát triển năng lực thiết thực",
  "knowledgeAnalysis": [
    {
      "questionId": "q_1",
      "question": "Câu hỏi trong buổi phỏng vấn",
      "rating": "Chưa tốt | Tốt | Xuất sắc",
      "analysis": "Nhận xét khách quan về câu trả lời thực tế",
      "strengths": "Điểm ứng viên trả lời đúng và có minh chứng",
      "gaps": "Lỗ hổng kiến thức hoặc điểm thiếu sót trong câu trả lời",
      "recommendation": "Định hướng nâng cao chuyên môn (kỹ thuật: trade-off/kiến trúc; tình huống: tư duy xử lý; hành vi: mô hình STAR)",
      "supplement": "Kiến thức chuẩn bổ sung nếu câu trả lời chưa đầy đủ",
      "evidence": "Minh chứng trích từ câu trả lời của ứng viên"
    }
  ]
}
""";

            return $$"""
{{langInstruction}}

{{PromptGroundingPolicy.Instruction}}

{{PromptContextBoundary.SecurityDisclaimer}}

Bạn là chuyên gia thẩm định phỏng vấn và đánh giá năng lực tuyển dụng cấp cao.
Nhiệm vụ: Phân tích TOÀN BỘ buổi phỏng vấn cho vị trí: "{{jobTitle}}".

====================
LỊCH SỬ PHỎNG VẤN (TRANSCRIPT)
====================
{{PromptContextBoundary.Wrap("INTERVIEW_TRANSCRIPT", qaTranscript)}}

====================
NGUYÊN TẮC ĐÁNH GIÁ
====================
1. CHỈ ĐÁNH GIÁ DỰA TRÊN DỮ LIỆU THỰC TẾ:
   - Tổng hợp từ transcript thực tế của buổi phỏng vấn.
   - TUYỆT ĐỐI KHÔNG tự dựng lại sự kiện, dự án hay công nghệ chưa có trong nguồn dữ liệu.
   - Không tự thêm số liệu, vai trò cá nhân chỉ để báo cáo trông đầy đủ.
2. TIÊU CHÍ ĐÁNH GIÁ (CRITERIA):
   - Đánh giá 4 khía cạnh: Technical Knowledge, Communication, Problem Solving, Attitude.
   - Xếp loại từng tiêu chí theo 3 mức: "Chưa tốt", "Tốt", "Xuất sắc".
3. THANG ĐIỂM CHUẨN HOÁ (0 - 100):
   - Các điểm số (overallScore, techScore, commScore, softScore, starScore) phải tính toán trên thang điểm 0 - 100 dựa trên mức độ đáp ứng năng lực.
   - Không chấm điểm ngẫu nhiên (no random scores).
4. PHÂN TÍCH CHUYÊN MÔN (KNOWLEDGE ANALYSIS):
   - Đánh giá riêng cho từng câu hỏi chính thức (bỏ qua phần Giới thiệu bản thân mở đầu).
   - questionId: sử dụng đúng questionId tương ứng (q_1 đến q_5).
   - strengths: nêu rõ điểm tốt có minh chứng từ câu trả lời thực tế.
   - gaps: nêu điểm thiếu sót hoặc ngộ nhận thực tế.
   - recommendation: hướng dẫn chuyên môn phù hợp:
     * Câu hỏi Kỹ thuật: phân tích cơ chế, trade-off, failure cases (KHÔNG ép mô hình STAR cho câu hỏi kỹ thuật).
     * Câu hỏi Tình huống: cách xử lý rủi ro và thứ tự ưu tiên.
     * Câu hỏi Hành vi: bối cảnh, hành động và kết quả (STAR).
   - supplement: kiến thức chuẩn mở rộng nếu câu trả lời chưa đầy đủ.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
