# POS SaaS Instagram Upgrade v3 - HR + POS Offline

## Nhóm nâng cấp chính

### 1. Quản lý nhân viên nâng cao
- Phân quyền: Thu ngân, Phục vụ, Quản lý, Chủ quán, Bếp, Bar, Kế toán.
- Hồ sơ nhân viên có mã NV, vị trí, lương theo ca, tỷ lệ hoa hồng.
- Quyền chi tiết theo tài khoản: thanh toán, giảm giá, sửa giá, hủy bill.
- Trang mới: `/admin/hr`.

### 2. Chấm công và ca làm
- Tạo ca làm theo chi nhánh.
- Chấm vào / chấm ra.
- Quản lý người đang trong ca.
- Ghi audit log khi chấm công.

### 3. Hoa hồng
- Tạo quy tắc hoa hồng theo vai trò.
- Tự ghi nhận hoa hồng khi thanh toán bill nếu tài khoản có `commissionRate`.
- Xem lịch sử hoa hồng tại `/admin/hr`.

### 4. Nhật ký thao tác
- Trang mới: `/admin/audit-logs`.
- Theo dõi được:
  - Ai hủy bill?
  - Ai sửa giá?
  - Ai giảm bill?
  - Ai chuyển bàn?
  - Ai tách bill / gộp bill?
  - Ai in hóa đơn?
  - Ai thanh toán?

### 5. POS nâng cao
- Order tại bàn.
- Chuyển món realtime xuống bếp/bar.
- Thanh toán tiền mặt, chuyển khoản, QR, thẻ, ví điện tử.
- API hỗ trợ hủy bill, giảm giá, sửa giá, chuyển bàn, tách/gộp bill, in hóa đơn.

### 6. Offline mode
- Nếu mất mạng hoặc API lỗi, POS sẽ lưu order vào `localStorage`.
- Khi có mạng, bấm “Đồng bộ offline” để đẩy order lên backend.
- Backend có bảng `OfflineSyncLog` để tránh đồng bộ trùng đơn.

## Chạy bản mới

```powershell
docker compose down -v --remove-orphans
docker rm -f pos_saas_redis pos_saas_postgres pos_saas_api pos_saas_web
copy .env.example .env
docker compose up --build
```

## Tài khoản demo

- Chủ quán: `owner@demo.vn` / `Admin@123456`
- Order: `order@demo.vn` / `Admin@123456`
- Thu ngân: `cashier@demo.vn` / `Admin@123456`

## Lưu ý

Bản này có thêm bảng database mới, nên nên chạy `docker compose down -v` để tạo database sạch.
