# Stype POS v11 - Thông tin quán + Excel báo cáo chuyên nghiệp

## Nâng cấp chính

### 1. Chủ quán sửa tên quán, địa chỉ, số điện thoại
- Vào `/settings/themes`.
- Chủ quán có thể chỉnh:
  - Tên quán
  - Địa chỉ quán
  - Số điện thoại quán
  - Tên app
  - Slogan động
  - QR thanh toán
  - Ngưỡng hóa đơn được tính hoa hồng
- Thông tin quán được lưu ở bảng `Tenant` và dùng lại trên hóa đơn/bill in nhiệt.

### 2. Excel báo cáo doanh thu có kẻ khung
- Endpoint `/reports/revenue/export` xuất file `.xlsx` thật bằng ExcelJS.
- File có nhiều sheet:
  - Tổng hợp
  - Doanh thu ngày
  - Phương thức
  - Top món
  - Chi tiết hóa đơn
- Có title, màu header, border/kẻ khung, định dạng tiền tệ, thông tin quán và thời gian xuất báo cáo.

### 3. Excel bảng lương có kẻ khung
- Endpoint mới: `/hr/payroll/export?month=YYYY-MM`.
- File có title, phần tổng hợp, bảng chi tiết nhân viên, border và định dạng số tiền.
- Chủ quán xem/xuất toàn bộ; nhân viên thường chỉ xuất được lương của chính mình.

## Ghi chú triển khai
- API thêm dependency `exceljs`.
- Khi chạy Docker, `npm install` sẽ tự cài dependency mới.
- Nên chạy `docker compose down -v` nếu muốn reset dữ liệu demo sạch.
