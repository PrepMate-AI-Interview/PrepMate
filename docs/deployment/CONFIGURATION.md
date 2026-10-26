# PrepMate Deployment — Configuration Reference

## 1. Environment Variables

| Variable | Description | Default (Dev) | Production Requirement |
| :--- | :--- | :--- | :--- |
| `PORT` | HTTP port on which Kestrel listens. | `5000` | Mandatory if behind reverse proxy. |
| `JWT__SECRET` | 256-bit symmetric signing secret for JWT tokens. | Built-in dev secret fallback | **Mandatory**; generate cryptographically secure key. |
| `JWT__ISSUER` | JWT Issuer claim. | `PrepMateBackend` | Set to authoritative production domain. |
| `JWT__AUDIENCE` | JWT Audience claim. | `PrepMateFrontend` | Set to authoritative client domain. |

---

## 2. In-Memory & Database Configurations
Stored in `FileDb.AIConfigurations["default"]` and manageable via Admin Console (`/api/admin/ai/config`):
- `Provider`: AI service identifier (e.g. `"Vilao AI"`).
- `BaseUrl`: Upstream API root endpoint (e.g. `"https://api.vilao.ai/v1/"`).
- `Model`: Target LLM model name (e.g. `"ag/gemini-3.8-flash"`).
- `ApiKey`: LLM gateway authentication bearer token.
- `Temperature`: Sampling temperature (recommended `0.7`).
- `MaxTokens`: Completion token limit per turn (default `1000`).
