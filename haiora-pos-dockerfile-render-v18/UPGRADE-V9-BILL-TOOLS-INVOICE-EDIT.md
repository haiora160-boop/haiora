# Stype POS v9 - Tách bill / Gộp bill / Chuyển bàn / Sửa hóa đơn cũ

## Nâng cấp chính

### 1. POS - Tách bill
- Từ bàn đang có bill mở, bấm **Tách bill**.
- Chọn các món cần tách sang bill mới.
- Hệ thống tạo một bill mới cùng bàn, đồng thời trừ các món đó khỏi bill gốc.
- Ghi audit log: `SPLIT_BILL`.

### 2. POS - Gộp bill
- Từ bill hiện tại, bấm **Gộp bill**.
- Chọn bill đích trong danh sách bill chưa thanh toán.
- Hệ thống chuyển toàn bộ món từ bill nguồn sang bill đích.
- Bill nguồn được chuyển trạng thái `CANCELLED` để tránh tính trùng doanh thu.
- Ghi audit log: `MERGE_BILL`.

### 3. POS - Chuyển bàn
- Từ bàn đang có bill mở, bấm **Chuyển bàn**.
- Chọn bàn đích.
- Hệ thống cập nhật order sang bàn mới, bàn cũ trả về trống, bàn mới chuyển sang có khách.
- Ghi audit log: `CHANGE_TABLE`.

### 4. Chủ quán xem lại và sửa hóa đơn cũ
Trang mới: `/invoices`

Chủ quán có thể:
- Xem lại hóa đơn đã thanh toán.
- Tìm theo mã hóa đơn.
- Lọc theo trạng thái.
- Sửa ghi chú hóa đơn.
- Sửa giảm giá, thuế/phụ thu.
- Sửa tên món, số lượng, đơn giá, ghi chú món.
- Xóa món khỏi hóa đơn cũ.
- In lại hóa đơn nhiệt 80mm.

Khi sửa hóa đơn đã thanh toán:
- Hệ thống tính lại subtotal/total.
- Payment gần nhất được đồng bộ lại để báo cáo doanh thu khớp với hóa đơn đã sửa.
- Ghi audit log:
  - `OWNER_EDIT_OLD_INVOICE`
  - `OWNER_EDIT_OLD_INVOICE_ITEM`
  - `OWNER_DELETE_OLD_INVOICE_ITEM`

## API mới

```txt
GET    /invoices
PATCH  /invoices/:orderId
PATCH  /invoices/:orderId/items/:itemId
DELETE /invoices/:orderId/items/:itemId
```

## API cũ được dùng lại

```txt
POST  /pos/orders/:id/split-bill
POST  /pos/orders/:id/merge-bill
PATCH /pos/orders/:id/change-table
```

## Lưu ý vận hành

- Chức năng sửa hóa đơn cũ chỉ dành cho `OWNER`.
- Các thao tác sửa hóa đơn cũ đều được ghi nhật ký.
- Khi sửa hóa đơn đã thanh toán, báo cáo doanh thu sẽ theo số tiền sau chỉnh sửa.
