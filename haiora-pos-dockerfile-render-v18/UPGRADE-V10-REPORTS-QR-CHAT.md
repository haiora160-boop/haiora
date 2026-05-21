# Stype POS v10 - Báo cáo doanh thu, QR thanh toán và chat nội bộ

## Tính năng mới

### 1. Báo cáo doanh thu hoạt động ổn định hơn
- Sửa logic lọc ngày: khi chọn ngày kết thúc trên giao diện, hệ thống tự lấy hết ngày đó thay vì dừng ở 00:00.
- Báo cáo hiển thị doanh thu đã thu theo Payment PAID.
- Có doanh thu theo ngày, phương thức thanh toán, top món bán chạy và thanh toán gần đây.
- Xuất file CSV có BOM UTF-8, mở bằng Excel tiếng Việt rõ dấu.

### 2. QR thanh toán liên kết hóa đơn
- Chủ quán vào **Giao diện & slogan** để upload QR thanh toán.
- QR được lưu theo tenant/workspace.
- Hóa đơn bill nhiệt 80mm sẽ in QR kèm:
  - mã hóa đơn
  - tổng tiền
  - ghi chú chuyển khoản do chủ quán cấu hình
- Phù hợp dùng QR ngân hàng/MOMO/VNPAY tĩnh trước, sau này có thể nâng cấp QR động theo hóa đơn.

### 3. Phòng chat công việc realtime
- Trang mới: `/chat`
- Nhân viên trong cùng workspace/chi nhánh có thể nhắn tin nội bộ.
- Tin nhắn lưu database bằng model `ChatMessage`.
- Tin nhắn mới phát realtime qua Socket.IO.
- Dùng cho thu ngân, phục vụ, bếp/bar, quản lý trao đổi công việc.

## Database mới

### Tenant
Thêm:
- `paymentQrUrl`
- `paymentQrNote`

### ChatMessage
Thêm model mới:
- tenantId
- branchId
- senderId
- content
- createdAt

## API mới

```txt
GET  /chat/messages
POST /chat/messages
PATCH /settings/branding  // thêm paymentQrUrl, paymentQrNote
GET  /settings/branding   // trả về QR thanh toán
```

## Frontend mới

```txt
/chat
/settings/themes    // thêm upload QR thanh toán
/print/invoice/[orderId]  // in QR lên bill nhiệt
/reports            // báo cáo dùng logic ngày đã sửa
```

## Lưu ý khi chạy
Vì có thêm trường database và model mới, nên nên chạy:

```bash
docker compose down -v
```

để database tạo lại sạch trong môi trường demo/local.
