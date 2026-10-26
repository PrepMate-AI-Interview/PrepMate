# PrepMate Feature — Virtual Interview Experience

## 1. Overview
The interview experience in PrepMate consists of a 4-step pre-flight setup wizard and a live virtual conference HUD (Heads-Up Display) simulating real-world remote interview platforms (Zoom, Teams, Google Meet).

---

## 2. 4-Step Setup Wizard (`interview-info.html`)
Candidates configure their interview environment through structured steps:
1. **Target Role & Domain:** Select job family (IT, Marketing, Finance, HR, BA) and specify exact job title.
2. **Context & Materials:** Paste resume text or drag-and-drop a PDF/TXT resume; optionally paste target Job Description (JD).
3. **Session Strategy:** Choose question budget (3–10 questions) and target duration (10–45 minutes).
4. **Hardware & Environment Check:** Live browser verification of webcam, microphone permissions, and audio feedback test.

---

## 3. Live Interview Room HUD (`interview-practice.html`)

### 3.1 Interface Components
- **Interviewer Video Tile:** Avatar displaying active speaking state and audio indicator.
- **Candidate Video Tile:** Real-time WebRTC webcam stream (`navigator.mediaDevices.getUserMedia`) with toggle controls.
- **Meeting HUD Bar:** Microphone mute/unmute, Camera on/off, TTS speaker toggle, Pause session, End session.
- **Chat Transcript:** Turn-by-turn conversation log with interviewer questions and candidate responses.
- **Timers:**
  - *Session Timer:* Tracks total elapsed time since session start.
  - *Think Time Timer:* Configurable countdown guiding the candidate's response preparation.

### 3.2 UI State Machine Transitions
All room interaction is controlled by `setInterviewUIState(state)`:

```text
[not_started] -> [speaking] -> [listening] -> [processing] -> [speaking] ... -> [completed]
                      ^            |
                      |            v
                      +------- [paused]
```

- `not_started`: All inputs and media disabled until candidate confirms start.
- `speaking`: AI interviewer is reading the question.
- `listening`: Candidate input enabled, microphone listening, timer ticking.
- `processing`: Answer submitted; inputs locked, thinking indicator active.
- `paused`: Media streams paused, timers frozen.
- `completed`: Room closed; hardware streams released; user redirected to report.

---

## 4. Hardware Teardown
To ensure zero persistent background hardware access, `stopCamera()` and `stopSpeechRecognitionSilently()` are triggered upon room completion, route navigation, or `window.addEventListener("beforeunload")`.
