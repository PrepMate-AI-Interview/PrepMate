# PrepMate Feature — STAR Performance Diagnostic Report

## 1. Overview
The reporting engine (`backend.Services.Interview.InterviewReportService` and `FinalEvaluationService`) provides an objective, multi-dimensional assessment of candidate performance following interview completion.

---

## 2. Evaluation Dimensions

| Scoring Dimension | Metric Key | Evaluation Focus |
| :--- | :--- | :--- |
| **Overall Score** | `overallScore` | Composite performance average (1–100 scale). |
| **Technical Depth** | `techScore` | Conceptual accuracy, architectural reasoning, and domain competence. |
| **Communication Clarity** | `commScore` | Brevity, logical structure, and articulation. |
| **Soft Skills & Collaboration**| `softScore` | Team dynamics, empathy, and stakeholder engagement. |
| **STAR Framework Adherence** | `starScore` | Clear articulation of Situation, Task, Action, and quantifiable Result. |
| **Situational Judgment** | `situationalScore` | Problem-solving under pressure, ethics, and adaptability. |

---

## 3. API Contract & Persistence
- **Route:** `POST /api/ai/end-interview` (Alias: `POST /api/ai/report`)
- **Request Body:**
  ```json
  {
    "sessionId": "session_1791211245000"
  }
  ```
- **Response Format (`200 OK`):**
  ```json
  {
    "sessionId": "session_1791211245000",
    "overallScore": 85,
    "techScore": 88,
    "commScore": 82,
    "softScore": 80,
    "starScore": 84,
    "situationalScore": 86,
    "strengths": "Nắm vững nguyên lý hệ thống phân tán và kiến trúc microservices.",
    "improvements": "Cần bổ sung các chỉ số định lượng cụ thể khi giải thích kết quả dự án.",
    "suggestion": "Tiếp tục thực hành các câu hỏi về xử lý xung đột dữ liệu phân tán."
  }
  ```
- **State Transition:** The session status transitions to `"completed"`. Any subsequent attempts to mutate or answer questions in this session are rejected with HTTP 400.

---

## 4. Frontend Presentation (`report.html`)
The report page parses the JSON scorecard and renders:
- High-level candidate status badge.
- Interactive radar chart visualizing dimension balance.
- Strengths and growth opportunities callout cards.
- Quick CTAs to retake the interview, review history, or download PDF report.
