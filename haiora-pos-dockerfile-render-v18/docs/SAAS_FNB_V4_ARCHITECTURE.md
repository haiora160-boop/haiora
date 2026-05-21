# Coffee/F&B POS SaaS v4 Architecture

## Mục tiêu
Bản v4 refactor hệ thống theo hướng SaaS F&B: mỗi quán là một workspace/tenant riêng, có nhiều chi nhánh, nhiều vai trò, POS realtime, KDS bếp/bar, offline queue và dashboard vận hành.

## Kiến trúc đề xuất

```txt
apps/web      Next.js + Tailwind + Zustand + Socket.IO Client
apps/api      Node.js/Express + Prisma + PostgreSQL + Socket.IO + Redis-ready
apps/mobile   React Native Expo scaffold
PostgreSQL    Source of truth cho tenant, order, stock, CRM, audit
Redis         Cache/session/socket adapter khi scale nhiều instance
Docker        Local/prod parity
Render/VPS    Cloud deployment
```

## Multi-tenant
- `Tenant` = workspace/quán/khách thuê phần mềm.
- Tất cả dữ liệu nghiệp vụ có `tenantId`.
- Dữ liệu theo chi nhánh có thêm `branchId`.
- API lấy `tenantId` và `branchId` từ JWT để chống lẫn dữ liệu giữa các khách hàng.

## Module chính
1. POS bán hàng: bàn, món, ghi chú, thanh toán, offline sync.
2. Quản lý bàn: khu vực, trạng thái, realtime.
3. Menu: danh mục, món, ảnh, giá, size, topping, combo-ready.
4. Kho: nguyên liệu, tồn thấp, nhập/xuất, công thức món.
5. KDS: bếp/bar nhận món realtime, đổi trạng thái, chuông báo POS.
6. Nhân viên: vai trò, quyền thao tác, ca làm, chấm công, hoa hồng, audit log.
7. Báo cáo: doanh thu, top món, AI insight, export roadmap.
8. CRM: khách hàng, điểm, voucher/membership roadmap.
9. QR Self-order: scaffold luồng khách tự gọi món.
10. AI: insight từ doanh thu và tồn kho, roadmap dự báo doanh thu/nhập hàng.

## Vai trò
- `SUPER_ADMIN`: quản lý toàn hệ thống SaaS.
- `OWNER`: chủ quán/workspace.
- `MANAGER`: quản lý chi nhánh.
- `CASHIER`: thu ngân/thanh toán.
- `WAITER`: phục vụ/order tại bàn.
- `KITCHEN`: bếp.
- `BAR`: pha chế.
- `ACCOUNTANT`: kế toán/báo cáo.

## Workflow order
1. Phục vụ/thu ngân chọn bàn.
2. Chọn món, ghi chú từng món, ghi chú order.
3. Tạo order → table chuyển trạng thái `OCCUPIED`.
4. KDS nhận ticket realtime.
5. Bếp/bar bấm hoàn thành → POS nhận notification/chuông.
6. Thu ngân thanh toán tiền mặt/QR/thẻ/ví.
7. Hệ thống ghi audit log + hoa hồng + cập nhật dashboard.

## Offline mode
- POS lưu order vào `localStorage` nếu API/mạng lỗi.
- Khi có mạng, bấm “Đồng bộ offline”.
- API ghi `OfflineSyncLog` để chống đồng bộ trùng `localId`.

## Bảo mật
- JWT auth.
- RBAC + permission flag cho thao tác nhạy cảm.
- Rate limit.
- Helmet.
- Audit log cho hủy bill, sửa giá, giảm bill, chuyển bàn, in bill, thanh toán.
- Không commit secret, dùng `.env`.

## Roadmap production
- Tách API thành module NestJS khi scale đội dev.
- Dùng Redis adapter cho Socket.IO khi chạy nhiều instance.
- Object storage cho ảnh upload thay vì lưu local container.
- Queue background jobs cho export PDF/Excel, SMS/Zalo.
- Row-level security hoặc middleware tenant guard nâng cao.
- Test suite: unit, integration, e2e POS flow.
