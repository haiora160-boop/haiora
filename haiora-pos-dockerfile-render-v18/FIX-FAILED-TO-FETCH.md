# Sửa lỗi đăng nhập: Failed to fetch

Nguyên nhân thường gặp:

1. API chưa chạy ở `http://localhost:4000/health`.
2. Web mở bằng `127.0.0.1` hoặc IP mạng LAN nhưng API đang cấu hình cứng `localhost`.
3. CORS backend chỉ cho phép `localhost:3000`.
4. PostgreSQL ngoài máy chiếm port `5432`.

Bản này đã sửa:

- PostgreSQL host port đổi sang `5433:5432`.
- Web tự nhận API theo hostname đang mở, ví dụ `localhost`, `127.0.0.1`, hoặc `192.168.x.x`.
- API cho phép CORS với `localhost`, `127.0.0.1` và IP mạng LAN nội bộ.

Chạy lại:

```powershell
docker compose down -v
docker builder prune -f
docker compose up --build
```

Kiểm tra:

```txt
http://localhost:4000/health
http://localhost:3000
```

Tài khoản demo:

```txt
owner@demo.vn
Admin@123456
```
