# HAIORA POS - Deploy Render bằng Dockerfile

## Cấu trúc đúng trên GitHub
Ngoài cùng repo phải có:

```txt
apps/
Dockerfile
Dockerfile.api
Dockerfile.web
render.yaml
package.json
docker-compose.yml
.env.example
README.md
```

Không upload file ZIP. Hãy giải nén và upload source.

## Cách 1: Deploy bằng Blueprint

1. Vào Render Dashboard.
2. Chọn **New +**.
3. Chọn **Blueprint**.
4. Chọn repo GitHub của bạn.
5. Render đọc file `render.yaml` và tạo:
   - `haiora-api`
   - `haiora-web`
   - `haiora-db`

Sau khi deploy xong, lấy link thật của API và Web rồi sửa Environment:

### API Environment

```env
CORS_ORIGIN=https://LINK-WEB-THAT.onrender.com
WEB_URL=https://LINK-WEB-THAT.onrender.com
API_PUBLIC_URL=https://LINK-API-THAT.onrender.com
PUBLIC_UPLOAD_BASE_URL=https://LINK-API-THAT.onrender.com
```

### Web Environment

```env
NEXT_PUBLIC_API_URL=https://LINK-API-THAT.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://LINK-API-THAT.onrender.com
```

Sau đó Manual Deploy lại API và Web.

## Cách 2: Tạo thủ công từng Docker service

### Tạo database
Render → New + → Postgres

```txt
Name: haiora-db
Database: haiora_db
User: haiora_user
```

Copy Internal Database URL.

### Tạo API Docker service
Render → New + → Web Service → chọn repo.

```txt
Runtime: Docker
Name: haiora-api
Dockerfile Path: Dockerfile.api
Docker Build Context Directory: .
```

Environment:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://... Internal Database URL ...
JWT_SECRET=haiora_secret_123456789
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://LINK-WEB-THAT.onrender.com
WEB_URL=https://LINK-WEB-THAT.onrender.com
API_PUBLIC_URL=https://LINK-API-THAT.onrender.com
PUBLIC_UPLOAD_BASE_URL=https://LINK-API-THAT.onrender.com
```

### Tạo Web Docker service
Render → New + → Web Service → chọn repo.

```txt
Runtime: Docker
Name: haiora-web
Dockerfile Path: Dockerfile.web
Docker Build Context Directory: .
```

Environment:

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://LINK-API-THAT.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://LINK-API-THAT.onrender.com
```

## Test

API:

```txt
https://LINK-API-THAT.onrender.com/health
```

Web:

```txt
https://LINK-WEB-THAT.onrender.com/login
```

Tài khoản demo:

```txt
owner@demo.vn
Admin@123456
```

## Lưu ý
- Nếu thấy lỗi `failed to read dockerfile: open Dockerfile: no such file or directory`, repo chưa có Dockerfile ở root hoặc Dockerfile Path nhập sai.
- Nếu tạo Web service thủ công, phải chọn Dockerfile Path là `Dockerfile.web`.
- Nếu tạo API service thủ công, chọn Dockerfile Path là `Dockerfile.api`.
- Render Docker Blueprint dùng `dockerfilePath` và `dockerContext` trong `render.yaml`.
