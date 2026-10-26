# PrepMate Feature — Job Recommendations

## 1. Overview
The Job Recommendation module (`backend.Services.AI.JobRecommendationService`) analyzes candidate resume text and target industries to recommend relevant job titles along with explicit justifications.

---

## 2. API Contract
- **Route:** `POST /api/ai/job-recommendations`
- **Request Body:**
  ```json
  {
    "cvText": "Candidate resume text with full project history...",
    "jobTitle": "Backend Engineer",
    "language": "vi-VN"
  }
  ```
- **Response Format (`200 OK`):**
  ```json
  {
    "recommendations": [
      {
        "role": "Cloud Solutions Architect",
        "reason": "Strong background in Kubernetes, Terraform, and multi-region microservices."
      },
      {
        "role": "Site Reliability Engineer (SRE)",
        "reason": "Demonstrated expertise in distributed tracing, Prometheus monitoring, and high-availability SLA management."
      }
    ]
  }
  ```

---

## 3. Frontend Integration
Rendered on `FE/features/jobs/jobs.html`, displaying cards with recommended titles, compatibility scores, and quick action buttons to launch tailored practice sessions for those roles.
