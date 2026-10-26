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
      "question": "Câu hỏi trong buổi phỏng vấn",
      "rating": "Chưa tốt | Tốt | Xuất sắc",
      "analysis": "Nhận xét khách quan về câu trả lời thực tế",
      "supplement": "Kiến thức chuẩn bổ sung nếu câu trả lời chưa đầy đủ"
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
   - Với từng câu hỏi, đưa ra nhận xét trung thực (analysis).
   - Nếu câu trả lời thiếu hoặc sai, bổ sung kiến thức chuyên môn chuẩn (supplement) mang tính hướng dẫn tích cực.

{{PromptOutputPolicy.GetJsonContract(schema)}}
""";
        }
    }
}
