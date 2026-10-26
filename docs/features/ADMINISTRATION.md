# PrepMate Feature — Administration Console

## 1. Overview
The administration console (`FE/features/admin/admin.html` backed by `AdminController.cs` and `AIConfigurationController.cs`) provides operations management, candidate role control, and live AI engine configuration.

---

## 2. Administrative Capabilities

### 2.1 User Directory & Inspection
- **Route:** `GET /api/admin/users`
- **Authorized Roles:** `manager`, `admin`
- **Response (`200 OK`):** Ordered list of all registered platform users with subscription tier and creation dates.

### 2.2 Pro-Tier Plan Upgrade / Downgrade
- **Upgrade Route:** `POST /api/admin/users/{userId}/upgrade` (`admin` only)
- **Downgrade Route:** `POST /api/admin/users/{userId}/downgrade` (`admin` only)
- Updates user subscription tier directly with instant state persistence to `FileDb`.

### 2.3 Role Modification
- **Route:** `POST /api/admin/users/{userId}/role` (`admin` only)
- **Request Body:** `{"role": "manager"}`
- **Security Validation:** Rejects homoglyphs, non-ASCII characters, zero-width spaces, and unauthorized role names (e.g. `root`, `superadmin`). Accepts strictly `user`, `manager`, `admin`.

### 2.4 Account Deletion
- **Route:** `DELETE /api/admin/users/{userId}` (`admin` only)
- **Protection:** Prevents an administrator from deleting their own active account, mitigating accidental self-lockout.

### 2.5 Live AI Configuration
- **Route:** `GET /api/admin/ai/config` and `PUT /api/admin/ai/config` (`admin` only)
- **Parameters:** `provider`, `baseUrl`, `model`, `apiKey`, `enabled`, `temperature`, `maxTokens`.
- Allows instant updates to AI LLM parameters without restarting the .NET Kestrel server.
