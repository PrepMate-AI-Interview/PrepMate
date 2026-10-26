# PrepMate Deployment — Local Development Setup

## 1. Prerequisites
- **.NET SDK:** Version 10.0 or higher.
- **Node.js:** Version 20.0 or higher (v24 LTS recommended).
- **Git:** Version 2.40 or higher.

---

## 2. Running the Application

### 2.1 Start Backend & Frontend Server
The backend Kestrel server is configured to host both the RESTful API endpoints and the static frontend pages:
```bash
# Navigate to backend directory
cd BE

# Launch .NET application
dotnet run
```
The application will listen on `http://localhost:5000`.

### 2.2 Accessing the Application
- **Main Portal:** Open `http://localhost:5000` in any modern web browser (Chrome, Edge, Firefox, Safari).
- **Health Check:** `http://localhost:5000/api/health`.

---

## 3. Running Automated Tests

### 3.1 Static Regression Test Suite
Executes all 13 core regression, accessibility, responsive, and design consistency suites (no backend required):
```bash
node tests/run-all.js
```

### 3.2 Live Conversational Persona Suite
Executes multi-turn AI interview integration tests against the live server:
```bash
# Ensure backend is running in a separate terminal
node tests/run-integration.js
```
