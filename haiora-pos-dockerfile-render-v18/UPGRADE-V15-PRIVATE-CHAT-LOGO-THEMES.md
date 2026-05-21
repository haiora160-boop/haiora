# Stype POS v15 - Chat riêng + Theme đồng bộ logo HAIORA

## Nâng cấp chính

1. Chat riêng 1-1 giữa các tài khoản
- Thêm danh sách nhân viên trong trang `/chat`.
- Có tab `Chung` và `Riêng`.
- Tin nhắn riêng chỉ hiển thị trong cuộc trò chuyện giữa người gửi và người nhận.
- Realtime bằng Socket.IO qua room riêng theo user.

2. API chat mới
- `GET /chat/contacts`: lấy danh sách tài khoản có thể chat riêng.
- `GET /chat/messages?mode=private&recipientId=...`: tải lịch sử chat 1-1.
- `GET /chat/messages?mode=branch`: tải phòng chat chung.
- `POST /chat/messages`: gửi tin nhắn chung hoặc riêng.

3. Database chat mới
- Bảng `ChatMessage` bổ sung `recipientId` để phân biệt tin nhắn riêng.
- `User` có quan hệ `sentChatMessages` và `receivedChatMessages`.

4. Giao diện màu sắc mới
- Thêm theme `HAIORA Gold Sync` đồng bộ với logo vàng nâu.
- Thêm nhiều theme mới: Ocean Pro, Rose Milk, Graphite Gold, Lime Tea, Sky Clean.
- Theme mặc định đổi sang `HAIORA Gold Sync`.

## Cách chạy

```powershell
copy .env.example .env
docker compose down -v --remove-orphans
docker rm -f pos_saas_redis pos_saas_postgres pos_saas_api pos_saas_web
docker builder prune -f
docker compose up --build
```

Nếu báo `No such container` thì bỏ qua.

## Trang kiểm tra

- `/chat`: chat chung và chat riêng.
- `/settings/themes`: chọn giao diện, có theme đồng bộ logo HAIORA.
