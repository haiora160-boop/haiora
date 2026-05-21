# HAIORA POS - Render Ready Deploy Guide

## 1) Cấu trúc repo GitHub bắt buộc

Ngoài cùng repo phải thấy trực tiếp:

```txt
apps
.env.example
docker-compose.yml
package.json
render.yaml
README.md
```

Bấm vào `apps` phải thấy:

```txt
api
web
mobile
```

Nếu GitHub không có `apps/api` và `apps/web`, Render sẽ lỗi `cd: apps/api: No such file or directory` hoặc `cd: apps/web: No such file or directory`.

## 2) Cách upload đúng

Giải nén file ZIP này. Mở thư mục vừa giải nén, chọn tất cả nội dung bên trong gồm `apps`, `render.yaml`, `package.json`, `.env.example`... rồi upload/push vào root repo GitHub.

Không upload nguyên file ZIP. Không upload một thư mục cha bọc bên ngoài.

## 3) Deploy bằng Render Blueprint

Render Dashboard → New + → Blueprint → chọn repo GitHub → Connect.

Render sẽ đọc `render.yaml` và tạo:

```txt
haiora-api
haiora-web
haiora-db
```

## 4) Nếu deploy thủ công

### Database
Render → New + → Postgres:

```txt
Name: haiora-db
Database: haiora_db
User: haiora_user
```

### API Service
Render → New + → Web Service:

```txt
Runtime: Node
Root Directory: apps/api
Build Command: npm install && npx prisma generate && npm run build
Start Command: npx prisma db push && npm run db:seed && npm run start
```

Environment:

```env
NODE_VERSION=20.20.2
NODE_ENV=production
PORT=4000
DATABASE_URL=<Internal Database URL của Render Postgres>
JWT_SECRET=<chuỗi bí mật dài>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://haiora-web.onrender.com
WEB_URL=https://haiora-web.onrender.com
API_PUBLIC_URL=https://haiora-api.onrender.com
PUBLIC_UPLOAD_BASE_URL=https://haiora-api.onrender.com
```

### Web Service
Render → New + → Web Service:

```txt
Runtime: Node
Root Directory: apps/web
Build Command: npm install && npm run build
Start Command: npm run start
```

Environment:

```env
NODE_VERSION=20.20.2
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://haiora-api.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://haiora-api.onrender.com
```

## 5) Sau khi Render cấp link thật

Nếu Render tạo URL khác, sửa lại:

API service → Environment:

```env
CORS_ORIGIN=<link web thật>
WEB_URL=<link web thật>
API_PUBLIC_URL=<link api thật>
PUBLIC_UPLOAD_BASE_URL=<link api thật>
```

Web service → Environment:

```env
NEXT_PUBLIC_API_URL=<link api thật>
NEXT_PUBLIC_SOCKET_URL=<link api thật>
```

Sau đó Manual Deploy lại API và Web.

## 6) Test

API:

```txt
https://haiora-api.onrender.com/health
```

Web:

```txt
https://haiora-web.onrender.com/login
```

Tài khoản demo:

```txt
owner@demo.vn
Admin@123456
```

## 7) Lưu ý upload ảnh trên Render

Bản này lưu upload trong thư mục `apps/api/uploads`. Trên Render Free, filesystem có thể mất khi redeploy/restart. Khi dùng thật, nên nâng cấp sang Cloudinary / S3 / Cloudflare R2 hoặc gắn persistent disk cho API.
