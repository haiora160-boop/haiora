# Upgrade v4 - Coffee/F&B POS SaaS

## Tổng quan
Bản v4 nâng cấp hệ thống hiện tại thành nền tảng quản lý quán cà phê/nhà hàng dạng SaaS, tập trung vào workflow bán hàng nhanh, quản lý nhiều chi nhánh, realtime và khả năng mở rộng cloud.

## Thay đổi chính

### 1. Kiến trúc & tài liệu
- Thêm `docs/SAAS_FNB_V4_ARCHITECTURE.md`.
- Thêm `docs/DATABASE_V4.md`.
- Thêm `docs/API_V4.md`.
- Chuẩn hóa mô hình tenant/workspace/branch/role.

### 2. Database Prisma mở rộng
- Bổ sung các model extension cho:
  - Topping
  - Combo
  - ComboItem
  - Voucher
  - MembershipTier
  - TableReservation
  - DailyRevenueSnapshot
- Giữ nguyên các bảng đang hoạt động: POS, KDS, HR, Shift, Audit, OfflineSync.

### 3. API mới
- `/inventory/summary`
- `/inventory/ingredients`
- `/inventory/movements`
- `/crm/customers`
- `/ai/insights`

### 4. UI mới
- `/inventory`: kho nguyên liệu, tồn thấp, nhập/xuất.
- `/crm`: khách hàng, điểm, doanh thu CRM.
- `/ai`: gợi ý vận hành, món bán chạy, doanh thu 30 ngày.
- `/self-order`: scaffold QR Self-order.
- Sidebar thêm các module mới.

### 5. Workflow vẫn giữ
- POS order tại bàn.
- Gửi bếp/bar realtime.
- Bếp hoàn thành báo chuông về POS.
- Thanh toán tiền mặt/QR/thẻ/ví.
- Offline order queue.
- Chấm công/ca làm/hoa hồng.
- Audit log thao tác nhạy cảm.

## Cài đặt

```powershell
copy .env.example .env
docker compose down -v --remove-orphans
docker rm -f pos_saas_redis pos_saas_postgres pos_saas_api pos_saas_web
docker builder prune -f
docker compose up --build
```

Mở:

```txt
http://localhost:3000/login
http://localhost:4000/health
```

Tài khoản:

```txt
owner@demo.vn
Admin@123456
```

## Roadmap tiếp theo
1. Public QR order route thật cho khách.
2. Tích hợp cổng thanh toán QR callback.
3. Redis Socket.IO adapter cho scale nhiều API instance.
4. Upload ảnh lên S3/R2 thay vì local container.
5. Export Excel/PDF báo cáo.
6. Mobile app order cho phục vụ bằng React Native.
7. AI forecast doanh thu theo giờ/ngày.
8. Zalo OA/SMS CRM automation.
