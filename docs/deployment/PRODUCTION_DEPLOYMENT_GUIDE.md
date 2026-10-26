# PREPMATE — PRODUCTION DEPLOYMENT & ENVIRONMENT CONFIGURATION GUIDE

## 1. Kiến Trúc Môi Trường (Environment Architecture)

PrepMate được thiết kế để hoạt động độc lập với môi trường chạy (Environment-Independent), hỗ trợ chuyển đổi liền mạch giữa:
- **Local Development:** Frontend chạy trên Live Server (port 5501) hoặc trực tiếp từ ASP.NET Core Kestrel; kết nối backend qua localhost loopback.
- **Test / Staging:** Frontend và Backend có thể chạy độc lập trên các port/subdomain riêng biệt, hoặc cùng chạy sau một reverse proxy nội bộ.
- **Production Server:** Frontend và Backend tích hợp sau một Reverse Proxy (Nginx, Caddy, Cloudflare, Traefik, AWS ALB) có chứng chỉ TLS/HTTPS, định tuyến tất cả API qua `/api/*` với mô hình **Same-Domain**, triệt tiêu toàn bộ rủi ro CORS và rò rỉ cổng nội bộ ra Internet.

```
[ Client Browser (HTTPS) ]
          │
          ▼
[ Reverse Proxy (Nginx / Caddy / Cloudflare) ] (Port 80/443 - TLS Termination)
    ├── /           ──► [ Static Frontend Bundle (HTML/CSS/JS) ]
    └── /api/*      ──► [ ASP.NET Core Kestrel (Internal Port 5000 / $PORT) ]
                              │
                              ├── FileDb SSOT Storage (BE/data/db.json)
                              ├── ASP.NET Core DataProtection Keyring
                              └── Vilao AI Gateway (https://api.vilao.ai/v1)
                                      └── Logical Model Alias: "PrepMate"
```

---

## 2. Bảng Biến Môi Trường (Environment Variables Specification)

| Biến Môi Trường | Kiểu / Mặc Định | Môi Trường Áp Dụng | Mô Tả & Khuyến Nghị Production |
| :--- | :--- | :--- | :--- |
| `ASPNETCORE_ENVIRONMENT` | `Development` | Tất cả | Đặt thành `Production` khi chạy trên máy chủ thực tế. Kích hoạt policy CORS hạn chế và vô hiệu hóa exception stack trace rò rỉ ra client. |
| `ASPNETCORE_URLS` | `http://*:5000` | Staging / Prod | Địa chỉ Kestrel lắng nghe request từ reverse proxy nội bộ. Ví dụ: `http://127.0.0.1:5000` hoặc `http://0.0.0.0:8080`. |
| `PORT` | `5000` | Cloud PaaS / Docker | Thay thế `ASPNETCORE_URLS` trên các nền tảng tự cấp phát cổng (Heroku, AWS ECS, GCP Cloud Run, Render). |
| `DATABASE_FILE_PATH` | `data/db.json` | Tất cả | Đường dẫn tệp cơ sở dữ liệu SSOT. Khuyến nghị mount volume bền vững: `/var/prepmate/data/db.json`. |
| `PREPMATE_KEYRING_PATH`| `(OS default)` | Staging / Prod | Thư mục lưu trữ ASP.NET Core Data Protection Key Ring để mã hóa API key an toàn qua các chu kỳ tái khởi động container. |
| `JWT__SECRET` | `DefaultDevSecret` | Production | **BẮT BUỘC ĐỔI** trên Production thành chuỗi ngẫu nhiên tối thiểu 64 ký tự (SHA-256/256-bit). |
| `JWT__ISSUER` | `PrepMateBackend` | Production | Tên tổ chức phát hành token JWT. |
| `JWT__AUDIENCE` | `PrepMateFrontend`| Production | Tên đối tượng nhận token JWT. |
| `VILAO_API_KEY` | `""` | Production | Khóa API cấp phép từ Vilao AI Gateway. Backend tự động nhận diện và kích hoạt Live Inference cho alias `PrepMate`. |

---

## 3. Cấu Hình Frontend API Origin (Runtime Standardization)

Mọi tệp frontend (`main.js`, `auth.js`, `interview-api.js`, `report.js`) đều tuân theo chuỗi ưu tiên phân giải cấu hình:

1. **Meta Tag (DevOps Injection):**
   ```html
   <meta name="prepmate-api-base-url" content="https://api.prepmate.vn">
   ```
   *Áp dụng khi:* Frontend triển khai trên CDN hoặc máy chủ độc lập khác domain với Backend. Không cần rebuild file JS.
2. **Explicit Window Object:**
   ```javascript
   window.PREPMATE_API_BASE_URL = "https://api.prepmate.vn";
   // hoặc
   window.PREPMATE_CONFIG = { apiBaseUrl: "https://api.prepmate.vn" };
   ```
3. **Same-Origin Production (Khuyến Nghị Mặc Định):**
   - Khi chạy trên domain thực tế (bất kỳ hostname nào khác localhost), hàm trả về chuỗi rỗng `""`.
   - Mọi API call đều gửi qua đường dẫn tương đối `/api/sessions`, `/api/auth/login`, `/api/ai/...`.
   - **Tuyệt đối không nhúng localhost hoặc port 5000/5501 vào production bundle.**
4. **Local Development (VS Code Live Server):**
   - Tự động nhận diện hostname `127.0.0.1` / `localhost` và các port static server (`5500-5599`, `5173`, `3000`).
   - Tự động trỏ về `http://127.0.0.1:5000` để ngăn chặn lỗi HTTP 405 của Live Server.

---

## 4. Mẫu Cấu Hình Reverse Proxy (Reverse Proxy Templates)

### A. Cấu Hình Nginx (`nginx.conf`)
```nginx
# /etc/nginx/conf.d/prepmate.conf

upstream prepmate_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name prepmate.vn www.prepmate.vn;
    return 301 https://$host$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name prepmate.vn www.prepmate.vn;

    ssl_certificate /etc/letsencrypt/live/prepmate.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prepmate.vn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static Frontend Assets
    location / {
        root /var/www/prepmate/FE;
        index index.html;
        try_files $uri $uri/ /index.html;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    # Backend API Routing (Reverse Proxy)
    location /api/ {
        proxy_pass http://prepmate_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Health Check Endpoint
    location /health {
        proxy_pass http://prepmate_backend/health;
        proxy_set_header Host $host;
    }
}
```

### B. Cấu Hình Caddy (`Caddyfile`)
```caddy
prepmate.vn {
    # Tự động cấp và gia hạn chứng chỉ Let's Encrypt SSL/TLS
    encode gzip zstd

    # Security Headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Reverse Proxy cho API
    handle /api/* {
        reverse_proxy 127.0.0.1:5000 {
            header_up X-Forwarded-Proto {scheme}
            header_up X-Forwarded-Host {host}
        }
    }

    # Health Check
    handle /health {
        reverse_proxy 127.0.0.1:5000
    }

    # Phục vụ Frontend file tĩnh
    handle {
        root * /var/www/prepmate/FE
        file_server
        try_files {path} {path}/ /index.html
    }
}
```

---

## 5. Mẫu Triển Khai Container Docker & Compose

### A. Dockerfile (`Dockerfile`)
```dockerfile
# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY BE/backend.csproj BE/
RUN dotnet restore BE/backend.csproj
COPY BE/ BE/
RUN dotnet publish BE/backend.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
COPY --from=build /app/publish .
COPY FE/ /app/FE/

VOLUME ["/app/data", "/app/keys"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "backend.dll"]
```

### B. Docker Compose (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  prepmate:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ASPNETCORE_URLS=http://+:5000
      - DATABASE_FILE_PATH=/app/data/db.json
      - PREPMATE_KEYRING_PATH=/app/keys
      - JWT__SECRET=${JWT_SECRET_PRODUCTION}
      - VILAO_API_KEY=${VILAO_API_KEY_PRODUCTION}
    volumes:
      - prepmate_data:/app/data
      - prepmate_keys:/app/keys

volumes:
  prepmate_data:
  prepmate_keys:
```

---

## 6. Quy Trình Xác Minh Sau Deploy (Post-Deployment Verification)

1. **Liveness / Readiness Probe:**
   ```bash
   curl -I https://prepmate.vn/health
   # Kỳ vọng: HTTP/2 200 OK, {"status":"Healthy"}
   ```
2. **Kiểm Tra Không Lộ Cổng Nội Bộ:**
   ```bash
   curl -I http://prepmate.vn:5000
   # Kỳ vọng: Kết nối bị từ chối hoặc timeout (Kestrel chỉ lắng nghe trên mạng nội bộ / 127.0.0.1)
   ```
3. **Kiểm Tra TLS & Forwarded Headers:**
   - Đăng nhập tài khoản kiểm thử trên giao diện HTTPS.
   - Xác nhận JWT token được cấp phát với Issuer và Audience chính xác.
   - Xác nhận Network Tab trên trình duyệt gọi `POST /api/sessions` không còn bất kỳ mã lỗi `HTTP 405` nào.
4. **Kiểm Tra AI Gateway:**
   - Bắt đầu phiên phỏng vấn.
   - Kiểm tra log backend: xác nhận request chuyển tiếp đến `https://api.vilao.ai/v1/chat/completions` với `model: "PrepMate"`.
   - Network Tab trình duyệt không bao giờ hiển thị API Key bí mật.
