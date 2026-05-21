# Stype POS v13 - QR thanh toán động theo số tiền hóa đơn

## Mục tiêu

Bản v13 nâng cấp phần QR thanh toán trên hóa đơn nhiệt:

- Chủ quán nhập mã ngân hàng/BIN VietQR, số tài khoản và tên chủ tài khoản.
- Khi in từng hóa đơn, hệ thống tự tạo QR theo đúng số tiền thanh toán của bill.
- Khách quét QR sẽ thấy số tiền và nội dung chuyển khoản đã được điền sẵn.
- QR upload cũ vẫn được giữ làm ảnh dự phòng nếu chủ quán chưa cấu hình QR động.

## Trường dữ liệu mới

Bổ sung trong bảng `Tenant`:

- `paymentQrBankCode`
- `paymentQrAccountNo`
- `paymentQrAccountName`
- `paymentQrTemplate`

## Cấu hình trong app

Vào:

```txt
/settings/themes
```

Mục:

```txt
QR thanh toán động theo số tiền bill
```

Chủ quán nhập:

- Mã ngân hàng/BIN VietQR
- Số tài khoản nhận tiền
- Tên chủ tài khoản
- Mẫu QR
- Ghi chú QR

## Hóa đơn in ra

Route:

```txt
/print/invoice/[orderId]
```

Hóa đơn sẽ ưu tiên QR động nếu có đủ thông tin tài khoản. Nếu chưa có, hệ thống dùng QR ảnh chủ quán đã upload làm dự phòng.
