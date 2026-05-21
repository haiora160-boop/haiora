# Stype POS v8 - Thanh toán theo bàn + Hóa đơn bill nhiệt

## Mục tiêu
Bản v8 nâng cấp POS theo workflow quán cà phê/nhà hàng thực tế:

1. Chọn bàn trước khi order.
2. Mỗi bàn có một bill đang mở.
3. Gọi thêm món vào cùng bill của bàn.
4. Thanh toán theo bàn.
5. Bàn tự trả về trạng thái trống sau khi thanh toán.
6. In tạm tính và in hóa đơn khổ 80mm giống bill máy in nhiệt.

## Backend mới

### API mới

- `GET /pos/tables/:tableId/current-order`
  - Lấy bill đang mở của bàn.

- `POST /pos/tables/:tableId/checkout`
  - Kiểm tra bill đang mở của bàn trước khi thanh toán.

- `GET /invoices/:orderId`
  - Lấy dữ liệu hóa đơn/tạm tính.

- `POST /invoices/:orderId/print`
  - Ghi nhận số lần in và trả dữ liệu hóa đơn.

### Logic order theo bàn

- Nếu bàn chưa có bill: tạo order mới.
- Nếu bàn đã có bill chưa thanh toán: món mới được cộng vào bill cũ.
- Sau khi thanh toán: order chuyển `PAID`, bàn chuyển `AVAILABLE`.

## Database bổ sung

Trong `Order` có thêm:

- `receiptNo`: mã hóa đơn in nhiệt.
- `paidAt`: thời gian thanh toán.
- `printCount`: số lần in.
- `serviceType`: DINE_IN / TAKE_AWAY.

## Frontend mới

### POS

- Hiển thị bill đang mở của bàn đang chọn.
- Nút `In tạm` mở bill tạm tính 80mm.
- Nút `Thanh toán bàn đang chọn` thanh toán đúng bill của bàn.
- Danh sách bill chờ thanh toán có nút `In` và `Thu`.

### Trang in hóa đơn

Route mới:

```txt
/print/invoice/[orderId]?type=temp
/print/invoice/[orderId]?type=paid
```

Tối ưu cho giấy in nhiệt 80mm:

- Tên quán
- Địa chỉ / số điện thoại
- HÓA ĐƠN BÀN
- Giờ bắt đầu / giờ thanh toán
- Bảng món: tên, SL, giá, tổng
- Tổng dịch vụ / giảm giá / thanh toán
- Mã hóa đơn
- Thu ngân
- Lời cảm ơn

## Cách test nhanh

1. Vào `/pos`.
2. Chọn bàn, ví dụ Bàn 10.
3. Chọn món và bấm `Gửi bếp`.
4. Chọn thêm món, bấm `Gửi bếp` lần nữa để kiểm tra cộng vào bill cũ.
5. Bấm `In tạm`.
6. Chọn phương thức thanh toán.
7. Bấm `Thanh toán bàn đang chọn`.
8. Hóa đơn chính thức mở ra, bấm `In bill 80mm`.
