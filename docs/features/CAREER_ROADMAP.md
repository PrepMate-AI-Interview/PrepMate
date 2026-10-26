# PrepMate Feature — Career Roadmap

## 1. Overview
The Career Roadmap service (`backend.Services.AI.CareerRoadmapService`) synthesizes structured, progressive milestones to help candidates bridge the gap between their current skill profile and their target dream role.

---

## 2. API Contract
- **Route:** `POST /api/ai/career-roadmap`
- **Request Body:**
  ```json
  {
    "cvText": "Full candidate resume text...",
    "jobTitle": "Principal Solutions Architect",
    "language": "vi-VN"
  }
  ```
- **Response Format (`200 OK`):**
  ```json
  {
    "roadmap": [
      {
        "step": "Giai đoạn 1: Nắm vững Kiến trúc Phân tán & Concurrency",
        "advice": "Thực hành thiết kế Event-Driven Architecture với Kafka và xử lý idempotency."
      },
      {
        "step": "Giai đoạn 2: Tối ưu Hóa Hệ thống & FinOps",
        "advice": "Triển khai các chiến lược caching nhiều tầng và tối ưu chi phí hạ tầng điện toán đám mây."
      },
      {
        "step": "Giai đoạn 3: Lãnh đạo Kỹ thuật & Giao tiếp Chiến lược",
        "advice": "Rèn luyện kỹ năng trình bày Architecture Decision Records (ADRs) cho các bên liên quan cấp cao."
      }
    ]
  }
  ```

---

## 3. Frontend Integration
Rendered on `FE/features/progress/progress.html`, showcasing an interactive timeline of milestones with completion status, learning objectives, and recommended interview practice sessions.
