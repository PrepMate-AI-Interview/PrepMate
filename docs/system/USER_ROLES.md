# PrepMate — User Roles & Permissions Matrix

## 1. Role Definitions

The platform defines 4 distinct authorization roles:

1. **Guest (`guest`):**
   - Unauthenticated visitors exploring the platform.
   - Can run sample interview sessions, review instant session reports, view the pricing page, and browse the public landing page simulator.
   - Cannot persist account profiles, view long-term history, or save CVs.

2. **User (`user`):**
   - Standard registered candidates.
   - Has access to persistent profile data, multi-turn interview sessions, historical reports, CV storage, job recommendations, career roadmap, and plan upgrades.
   - Restricted strictly to their own resources (protected by BOLA/IDOR authorization).

3. **Manager (`manager`):**
   - Platform operational supervisor.
   - Can inspect candidate directory (`GET /api/admin/users`) and financial transaction audit logs (`GET /api/admin/transactions`).
   - Cannot modify AI configurations, change user roles, delete accounts, or perform manual subscription tier upgrades.

4. **Admin (`admin`):**
   - Complete administrative authority.
   - Full access to user management (role assignments, pro tier upgrades/downgrades, deletions).
   - Authority to update live AI gateway parameters (`provider`, `model`, `baseUrl`, `apiKey`, `temperature`, `maxTokens`).

---

## 2. API Authorization Matrix

| Endpoint Route | Guest | User | Manager | Admin |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/health` | 200 | 200 | 200 | 200 |
| `POST /api/auth/register` | 200 | 400 | 400 | 400 |
| `POST /api/auth/login` | 200 | 200 | 200 | 200 |
| `GET /api/auth/me` | 401 | 200 | 200 | 200 |
| `POST /api/sessions` (Create) | 200 | 200 | 200 | 200 |
| `GET /api/sessions/{id}` | 200 (Own) | 200 (Own) | 403 (Other) | 200 (All) |
| `POST /api/ai/respond` | 200 (Own) | 200 (Own) | 403 (Other) | 200 (All) |
| `POST /api/ai/end-interview` | 200 (Own) | 200 (Own) | 403 (Other) | 200 (All) |
| `GET /api/profile` | 401 | 200 | 200 | 200 |
| `PUT /api/profile` | 401 | 200 | 200 | 200 |
| `POST /api/cv` | 401 | 200 | 200 | 200 |
| `GET /api/cv/user/{userId}` | 401 | 200 (Self) / 403 (Other) | 200 | 200 |
| `POST /api/payment/process` | 401 | 200 (Self) | 200 (Self) | 200 |
| `GET /api/admin/users` | 401 | 403 | 200 | 200 |
| `POST /api/admin/users/{id}/upgrade` | 401 | 403 | 403 | 200 |
| `POST /api/admin/users/{id}/downgrade` | 401 | 403 | 403 | 200 |
| `POST /api/admin/users/{id}/role` | 401 | 403 | 403 | 200 |
| `DELETE /api/admin/users/{id}` | 401 | 403 | 403 | 200 (Non-Self) |
| `GET /api/admin/ai/config` | 401 | 403 | 403 | 200 |
| `PUT /api/admin/ai/config` | 401 | 403 | 403 | 200 |
