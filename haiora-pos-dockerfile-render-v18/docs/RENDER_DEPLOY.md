# Deploy Render

File `render.yaml` nằm ở thư mục gốc để Render đọc Blueprint.

## Quy trình

1. Push toàn bộ source lên GitHub.
2. Vào Render Dashboard.
3. Chọn New + → Blueprint.
4. Kết nối repository.
5. Render tạo 2 services:
   - `pos-saas-api`
   - `pos-saas-web`
6. Render tạo database:
   - `pos-saas-db`

## Biến môi trường cần kiểm tra

API:

```txt
DATABASE_URL
JWT_SECRET
CORS_ORIGIN
WEB_URL
```

WEB:

```txt
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SOCKET_URL
```

Nếu URL thật của Render khác với URL trong `render.yaml`, hãy sửa lại và redeploy web.
