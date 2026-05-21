# Upgrade V7 - Stype POS

## Thay đổi chính

- Đổi tên app sang `stype pos`.
- Mọi tài khoản đều được phép thanh toán hóa đơn.
- Hoa hồng được ghi nhận cho tài khoản tạo/gọi món, không phải tài khoản bấm thanh toán.
- Hoa hồng chỉ phát sinh khi giá trị thanh toán đạt ngưỡng `commissionMinSales` do Chủ quán cài đặt.
- Chỉ Chủ quán được phép chỉnh sửa dữ liệu quản trị quan trọng: tài khoản, lương, món, bàn, kho, ca làm, slogan, ngưỡng hoa hồng.
- Tài khoản nhân viên chỉ xem được lương của chính mình; Chủ quán xem toàn bộ.
- Thay dòng giới thiệu KiotViet bằng hệ slogan động do Chủ quán tự tạo.
- Thêm nhiều theme đẹp hơn: Stype Blue, Coffee Gold, Mint Fresh, Purple Pro, Dark Luxury, Sunset Bar.
- File Excel/CSV báo cáo doanh thu và bảng lương có phần tổng hợp + chi tiết rõ ràng hơn.
- POS tiếp tục hỗ trợ chọn bàn khi order tại quán.

## Cài đặt mới

Vào `/settings/themes` để chỉnh:

- Tên app
- Danh sách slogan động
- Ngưỡng hóa đơn được tính hoa hồng
- Theme giao diện

## Logic hoa hồng

1. Nhân viên A tạo/gọi món.
2. Bất kỳ tài khoản nào thanh toán bill.
3. Hệ thống kiểm tra giá trị thanh toán có đạt ngưỡng do Chủ quán đặt không.
4. Nếu đạt, hoa hồng ghi cho Nhân viên A theo % hoa hồng của tài khoản A.

