# V6 Payroll + Reports Upgrade

## Nâng cấp chính

- Thêm trường `salaryPerHour` cho nhân viên để tính lương theo giờ làm thực tế.
- Thêm API `/hr/payroll` để chủ quán/quản lý xem bảng lương toàn chi nhánh, nhân viên thường chỉ xem được lương của chính mình.
- Thêm API `/hr/salary/:userId` để chủ quán chỉnh lương/giờ, lương/ca và hoa hồng.
- Thêm trang `/salary` với bảng lương, tổng giờ, tổng lương giờ, hoa hồng và xuất Excel CSV.
- Chủ quán có thể xóa tài khoản nhân viên bằng API `DELETE /users/:id` và nút xóa trong `/admin/staff`.
- Sửa module báo cáo doanh thu: thêm API `/reports/revenue`, `/reports/revenue/export` và UI biểu đồ doanh thu.
- Thêm nút xuất Excel trong báo cáo doanh thu.
- Cải thiện upload hình: frontend tự chuẩn hóa URL ảnh trả về từ API, dùng được cho avatar và hình món.
- POS bổ sung dropdown chọn bàn ngay trong phiếu tạm, bắt buộc chọn bàn khi bán tại quán.

## Lưu ý khi chạy

Do schema có thêm trường `salaryPerHour`, nên nếu chạy local bằng Docker nên dùng:

```powershell
docker compose down -v --remove-orphans
docker compose up --build
```

Tài khoản demo:

- Chủ quán: `owner@demo.vn` / `Admin@123456`
- Thu ngân: `cashier@demo.vn` / `Admin@123456`
- Order: `order@demo.vn` / `Admin@123456`

