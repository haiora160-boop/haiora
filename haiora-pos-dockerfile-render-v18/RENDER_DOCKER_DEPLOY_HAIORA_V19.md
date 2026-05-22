# HAIORA POS v19 - Render Docker Deploy Fix

## Lỗi đã sửa
Render trước đó chạy `RUN npx prisma generate` trong Dockerfile.api. Nếu npm không tìm thấy Prisma local, `npx` tự kéo Prisma 7.8.0, dẫn đến lỗi:

```txt
The datasource property `url` is no longer supported in schema files
Prisma CLI Version : 7.8.0
```

Bản v19 đã khóa lại:

```bash
npx prisma@6.19.0 generate
npx prisma@6.19.0 db push
```

## Nếu repo GitHub có thư mục lồng
Nếu ngoài cùng repo là `haiora-pos-dockerfile-render-v19`, cấu hình Render API:

```txt
Runtime: Docker
Dockerfile Path: haiora-pos-dockerfile-render-v19/Dockerfile.api
Docker Build Context Directory: haiora-pos-dockerfile-render-v19
```

Web:

```txt
Runtime: Docker
Dockerfile Path: haiora-pos-dockerfile-render-v19/Dockerfile.web
Docker Build Context Directory: haiora-pos-dockerfile-render-v19
```

## Nếu đã đưa file ra ngoài root repo
API:

```txt
Dockerfile Path: Dockerfile.api
Docker Build Context Directory: .
```

Web:

```txt
Dockerfile Path: Dockerfile.web
Docker Build Context Directory: .
```

## API Environment

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
JWT_SECRET=haiora_secret_123456789
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://LINK-WEB.onrender.com
WEB_URL=https://LINK-WEB.onrender.com
API_PUBLIC_URL=https://LINK-API.onrender.com
PUBLIC_UPLOAD_BASE_URL=https://LINK-API.onrender.com
```

## Web Environment

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://LINK-API.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://LINK-API.onrender.com
```
