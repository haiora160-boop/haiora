# Upgrade Instagram POS SaaS

Bản này nâng cấp trên nền `pos-saas-platform-web-socket-fixed` và giữ nguyên kiến trúc Docker/GitHub/Render.

## Tính năng mới

- Giao diện sidebar + card + avatar theo phong cách Instagram.
- Admin quản lý món: thêm/sửa tên món, SKU, mô tả, giá bán, giá vốn, danh mục, link hình ảnh.
- Admin quản lý tài khoản: cấp tài khoản order, thu ngân, bếp, bar, kế toán, quản lý.
- Admin có thể đổi quyền và khóa/mở tài khoản.
- POS order có ghi chú từng món và ghi chú chung cho order.
- POS có khu vực thanh toán nhanh order chờ thu.
- Module thanh toán riêng: xem order chờ thanh toán, thu tiền theo tiền mặt/chuyển khoản/QR/thẻ/ví điện tử, lịch sử thu tiền.
- Mỗi tài khoản có thể cập nhật avatar, họ tên, số điện thoại.
- Seed demo có thêm tài khoản `order@demo.vn` và `cashier@demo.vn`.

## Tài khoản demo

- Chủ quán: `owner@demo.vn` / `Admin@123456`
- Nhân viên order: `order@demo.vn` / `Admin@123456`
- Thu ngân: `cashier@demo.vn` / `Admin@123456`
- Super Admin: `admin@possaas.vn` / `Admin@123456`

## Lưu ý khi nâng cấp

Vì schema có thêm trường `avatarUrl`, nên khi chạy local Docker nên dọn database cũ:

```powershell
docker compose down -v
docker rm -f pos_saas_redis pos_saas_postgres pos_saas_api pos_saas_web
docker builder prune -f
docker compose up --build
```

Mở:

- Web: http://localhost:3000/login
- API: http://localhost:4000/health
