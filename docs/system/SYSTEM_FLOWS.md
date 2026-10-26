# PrepMate — System Flows & Sequences

## 1. Authentication & Session Initialization Flow

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate / Client
    participant Frontend as Frontend (auth.js / interview.js)
    participant Kestrel as Backend Kestrel Server
    participant FileDb as Storage Engine (FileDb)

    Candidate->>Frontend: Enter credentials (username & password)
    Frontend->>Kestrel: POST /api/auth/login { email, password }
    Kestrel->>FileDb: Query user record & verify PBKDF2 hash
    alt Credentials Valid
        Kestrel-->>Frontend: 200 OK + JWT Bearer Token (Sub, Role)
        Frontend->>Frontend: Store token in localStorage (prepmate_current_user)
    else Invalid Credentials
        Kestrel-->>Frontend: 401 Unauthorized
        Frontend-->>Candidate: Display error toast notification
    end

    Candidate->>Frontend: Configure interview setup wizard
    Frontend->>Kestrel: POST /api/sessions (Bearer Token)
    Kestrel->>FileDb: Create session record linked to authenticated user
    Kestrel-->>Frontend: 200 OK { sessionId }
    Frontend->>Frontend: Redirect to /features/interview/interview-practice.html?sessionId={id}
```

---

## 2. Live Adaptive Interview Turn Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate
    participant HUD as Live Interview HUD
    participant FlowService as InterviewFlowService
    participant Engine as AdaptiveInterviewEngine
    participant Gemini as External AI Gateway (Vilao/Gemini)

    Candidate->>HUD: Provide verbal or typed response
    HUD->>HUD: Transition state: processing (Disable inputs & mic)
    HUD->>FlowService: POST /api/ai/respond { sessionId, message }
    FlowService->>FlowService: Validate session ownership (BOLA check)
    FlowService->>Engine: Evaluate candidate response against turn context
    Engine->>Gemini: Prompt LLM with STAR criteria & conversation history
    alt LLM Returns Valid JSON
        Gemini-->>Engine: Structured follow-up question or deepening topic
    else LLM Timeout or Insufficient Quota
        Engine->>Engine: Synthesize deterministic domain fallback
    end
    Engine-->>FlowService: Return Next Question & Adaptive Insights
    FlowService-->>HUD: 200 OK { reply, nextQuestion, topic, isFollowUp }
    HUD->>HUD: Play question via Web Speech TTS
    HUD->>HUD: Transition state: listening (Enable inputs & mic, start timer)
```

---

## 3. Interview Conclusion & STAR Report Generation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate
    participant HUD as Live Interview HUD
    participant ReportService as InterviewReportService
    participant Evaluation as FinalEvaluationService
    participant FileDb as Storage Engine (FileDb)

    Candidate->>HUD: Click "End Interview" or Max Turns Reached
    HUD->>ReportService: POST /api/ai/end-interview { sessionId }
    ReportService->>ReportService: Mark session status = "completed"
    ReportService->>Evaluation: Aggregate turns & compute STAR dimension scores
    Evaluation->>FileDb: Save finalized report scorecard
    ReportService-->>HUD: 200 OK { report: { overallScore, techScore, ... } }
    HUD->>HUD: Clean up camera & microphone tracks (stopTracks)
    HUD->>HUD: Redirect to /features/report/report.html?sessionId={id}
```
