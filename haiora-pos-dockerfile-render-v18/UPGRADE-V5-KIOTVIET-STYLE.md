# Upgrade V5 - KiotViet-inspired POS Layout

## Mục tiêu

Bản V5 refactor giao diện theo hướng gần giống trải nghiệm POS phổ biến tại Việt Nam: xanh chủ đạo, thao tác nhanh, màn hình bán hàng chia vùng rõ ràng, tab Phòng/Bàn - Thực đơn - Đặt gọi món - Giao đi, ô tìm kiếm F3 và phiếu tạm bên phải.

## Nguyên tắc thiết kế

- Không sao chép giao diện KiotViet y nguyên.
- Chỉ lấy cảm hứng từ bố cục POS quen thuộc: top bar xanh, menu dạng tab, sản phẩm dạng lưới, bill bên phải.
- Tối ưu thu ngân và nhân viên phục vụ dùng trên desktop/tablet.
- Giữ nguyên backend, database, Docker, API cũ nếu không cần thiết.

## Thay đổi chính

### 1. AppShell

- Bỏ layout Instagram sidebar lớn.
- Thêm top bar xanh cố định.
- Thêm sidebar quản trị gọn theo nhóm:
  - Bán hàng
  - Quản lý
  - Hệ thống
- Thêm ô tìm kiếm tổng quát.
- Thêm chọn theme ngay trên header.
- POS dùng layout full-width để tối ưu bán hàng.

### 2. POS Page

- Giao diện chia 3 cột:
  - Cột trái: kiểu bán + sơ đồ bàn.
  - Cột giữa: tab phòng/bàn, thực đơn, danh mục, lưới món.
  - Cột phải: phiếu tạm, ghi chú món, tổng tiền, gửi bếp, thanh toán.
- Thêm tab:
  - Phòng / Bàn
  - Thực đơn
  - Đặt gọi món
  - Giao đi
- Thêm tìm món nhanh kiểu F3.
- Giữ offline queue và đồng bộ lại khi có mạng.
- Giữ chuông báo khi bếp hoàn thành món.

### 3. Dashboard

- Đổi card thống kê sang phong cách back-office POS.
- Bố cục báo cáo giống phần mềm quản lý bán hàng: KPI, biểu đồ, AI insight, việc cần làm.

### 4. Login

- Đổi màn đăng nhập sang phong cách phần mềm quản lý bán hàng chuyên nghiệp.
- Nhấn mạnh POS F&B, kho, báo cáo, multi-tenant.

### 5. Theme

- Theme mặc định đổi thành `kiotviet`.
- Giữ thêm các theme:
  - Coffee Premium
  - Retail Clean
  - Dark POS

## File đã chỉnh

```txt
apps/web/components/app-shell.tsx
apps/web/app/pos/page.tsx
apps/web/app/dashboard/page.tsx
apps/web/app/login/page.tsx
apps/web/components/stat-card.tsx
apps/web/app/globals.css
apps/web/stores/theme-store.ts
```

## Hướng dẫn chạy

```powershell
copy .env.example .env
docker compose down -v --remove-orphans
docker rm -f pos_saas_redis pos_saas_postgres pos_saas_api pos_saas_web
docker builder prune -f
docker compose up --build
```

Nếu `docker rm` báo `No such container`, có thể bỏ qua.
