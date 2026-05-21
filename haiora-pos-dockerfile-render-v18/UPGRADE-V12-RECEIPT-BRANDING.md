# Stype POS v12 - Tùy biến nội dung in hóa đơn

## Nâng cấp chính

Chủ quán có thể tự nhập toàn bộ phần đầu và cuối bill nhiệt 80mm, gồm:

- Dòng đầu bill: ví dụ `In bởi STYPE POS`, `Phần mềm bán hàng STYPE POS`, hoặc để trống nếu không muốn in.
- Tên quán in trên bill: ví dụ `KING COFFEE`.
- Địa chỉ in trên bill.
- Số điện thoại in trên bill.
- Lời cảm ơn cuối bill, hỗ trợ nhiều dòng.

## Vị trí chỉnh trong app

Đăng nhập tài khoản chủ quán, vào:

```txt
/settings/themes
```

Tìm mục:

```txt
Thông tin in trên bill nhiệt
```

Sau khi lưu, bill ở route:

```txt
/print/invoice/[orderId]
```

sẽ tự dùng nội dung chủ quán đã nhập.

## Database mới

Thêm vào bảng Tenant:

```prisma
receiptHeaderLine String?
receiptShopName String?
receiptShopAddress String?
receiptShopPhone String?
receiptFooterNote String?
```

Nên chạy lại database sạch khi nâng cấp bản này:

```bash
docker compose down -v
docker compose up --build
```
