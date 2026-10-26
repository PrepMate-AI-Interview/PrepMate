# PrepMate Feature — CV Upload & Parsing

## 1. Overview
The CV Analysis module enables candidates to upload resumes, extract key technical and situational competencies, evaluate job suitability, and guide interview topic generation.

---

## 2. API Endpoints

### 2.1 CV Storage (`/api/cv`)
- **Route:** `POST /api/cv`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "rawText": "Nguyen Van A\nSenior Frontend Engineer...",
    "fileName": "resume.pdf",
    "fileSize": 105400,
    "skills": ["React", "TypeScript", "Next.js"],
    "readinessScore": 85
  }
  ```
- **Validation:**
  - `rawText`: Required, max 100,000 characters.
  - `fileSize`: Non-negative integer.
  - `readinessScore`: Optional, integer between 0 and 100.
- **Protection:** Users can only save their own CV; cross-user retrieval via `GET /api/cv/user/{userId}` is restricted to self and administrators.

### 2.2 AI CV Analysis (`/api/ai/analyze-cv`)
- **Route:** `POST /api/ai/analyze-cv`
- **Request Body:**
  ```json
  {
    "cvText": "Candidate resume text...",
    "jobTitle": "Frontend Architect"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "summary": "Experienced frontend engineer with strong architectural background.",
    "keySkills": ["React", "TypeScript", "Performance Optimization", "Microfrontends"],
    "experience": "5+ years in high-traffic web applications.",
    "suitability": 88,
    "suggestions": ["Add more concrete CI/CD pipeline automation metrics."]
  }
  ```
