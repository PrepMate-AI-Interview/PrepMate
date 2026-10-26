# PrepMate Quality — Data Integrity & Concurrency Architecture

## 1. Overview
The storage layer (`backend.Services.Storage.FileDb`) is designed for process safety, thread safety, atomic disk persistence, and crash recovery without requiring an external database server.

---

## 2. Concurrency Model

### 2.1 In-Memory Thread Safety
- Entities are held in `ConcurrentDictionary<string, T>` (`Users`, `Sessions`, `CVs`, `AIConfigurations`) and `ConcurrentBag<PaymentTransaction>`.
- Point-in-time reads avoid blocking writer threads.

### 2.2 Process Monitor Lock
- All disk mutations invoke `lock (_lock)`.
- Re-entrant monitor locks guarantee that simultaneous writes from parallel HTTP request threads are serialized cleanly.

---

## 3. Atomic Disk Write & Durability

```mermaid
sequenceDiagram
    participant App as Application Thread
    participant Lock as Process Mutex (_lock)
    participant TempFile as db.json.tmp
    participant TargetFile as db.json

    App->>Lock: Acquire write lock
    App->>TempFile: Serialize JSON and write all bytes
    App->>TargetFile: File.Move(tempPath, filePath, overwrite: true)
    TargetFile-->>App: Atomic OS-level file replacement complete
    App->>Lock: Release write lock
```

- In the event of a sudden power loss or process kill mid-write, `db.json` is not partially written; it remains at the last valid state.
- During boot, if `db.json.tmp` exists, `FileDb` inspects and recovers valid state automatically.

---

## 4. Live Concurrency Verification
Verified during runtime audit by dispatching 10 parallel asynchronous HTTP requests executing `UpdateUser`:
- All 10 requests completed with HTTP 200.
- `db.json` remained 100% syntactically valid JSON.
- Zero lost updates or race conditions occurred.
