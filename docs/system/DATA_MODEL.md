# PrepMate — Data Model & Entity Specifications

## 1. Storage Architecture
The persistence layer is managed by `FileDb.cs` and persists state as a unified JSON store to `BE/bin/Debug/net10.0/db.json`.

---

## 2. Core Entities

### 2.1 User (`backend.Models.User`)
Represents registered candidates and administrators.
```json
{
  "Id": "user_1791211132570",
  "Fullname": "Nguyen Van A",
  "Email": "candidate@prepmate.vn",
  "Username": "candidate_a",
  "Password": "",
  "PasswordHash": "zONWgxcIBO+rHx/njU2Etw==.VbieWcT3dCcIIFA2wOHLqwoMyC2JqWsEwpp8tdDVZ18=",
  "CreatedAt": "2026-10-07T11:00:00Z",
  "Role": "user",
  "Subscription": "free",
  "SubscriptionDate": null,
  "SubscriptionExpiry": null,
  "Phone": "0987654321",
  "Bio": "Software engineer with 4 years of Go experience.",
  "TargetRole": "Senior Backend Developer",
  "ExperienceLevel": "mid",
  "Skills": ["Go", "Kubernetes", "PostgreSQL"],
  "Location": "Hanoi, Vietnam",
  "UpdatedAt": "2026-10-07T11:30:00Z"
}
```
*Note: `Password` is always zeroed in storage; credentials are fundamentally stored using the 64-character PBKDF2 hash format: `{Base64Salt}.{Base64Hash}`.*

### 2.2 Session (`backend.Models.Session`)
Represents an interview session.
```json
{
  "Id": "session_1791211245000",
  "UserId": "user_1791211132570",
  "JobTitle": "Senior Backend Developer",
  "TargetCompany": "Fintech Global",
  "CvText": "Candidate resume text...",
  "JdText": "Job description text...",
  "Status": "completed",
  "CreatedAt": "2026-10-07T11:10:00Z",
  "CompletedAt": "2026-10-07T11:25:00Z",
  "InterviewState": {
    "SessionId": "session_1791211245000",
    "CurrentTurn": 3,
    "TargetTurns": 5,
    "InterviewPhase": "COMPLETED",
    "CandidateName": "Nguyen Van A",
    "TargetRole": "Senior Backend Developer",
    "Turns": []
  },
  "Report": {
    "OverallScore": 85,
    "TechScore": 88,
    "CommScore": 82,
    "SoftScore": 80,
    "StarScore": 84,
    "SituationalScore": 86,
    "Strengths": "Demonstrates strong distributed architecture understanding.",
    "Improvements": "Provide quantitative throughput metrics when describing Kafka queues.",
    "Suggestion": "Refine performance benchmark methodologies."
  }
}
```

### 2.3 CandidateCV (`backend.Models.CandidateCV`)
Stores active candidate resume data.
```json
{
  "Id": "cv_1791211245999",
  "UserId": "user_1791211132570",
  "FileName": "NguyenVanA_Resume.pdf",
  "RawText": "Full text of resume...",
  "FileSize": 142050,
  "IsActive": true,
  "UploadedAt": "2026-10-07T10:45:00Z",
  "ReadinessScore": 85
}
```

### 2.4 PaymentTransaction (`backend.Models.PaymentTransaction`)
Audit log for simulated financial checkout events.
```json
{
  "Id": "tx_1791211456000",
  "User": "user_1791211132570",
  "Plan": "pro",
  "Method": "momo",
  "Amount": 199000,
  "Status": "completed",
  "CreatedAt": "2026-10-07T11:40:00Z",
  "MomoPhone": "0987654321",
  "TransactionId": "MOMO_TX_1791211456000"
}
```

### 2.5 AIConfiguration (`backend.Models.AIConfiguration`)
Configures the live upstream LLM gateway.
```json
{
  "Id": "default",
  "Provider": "Vilao AI",
  "BaseUrl": "https://api.vilao.ai/v1/",
  "Model": "ag/gemini-3.8-flash",
  "ApiKey": "vla-***",
  "Enabled": true,
  "Temperature": 0.7,
  "MaxTokens": 1000
}
```
