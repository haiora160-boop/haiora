# POS SaaS Platform MVP

Bộ source nền cho hệ thống quản lý bán hàng đa ngành dạng SaaS: quán cà phê, quán ăn, nhà hàng, karaoke, bida, beer club, khu vui chơi, trà sữa.

## Stack

- Web: Next.js + TypeScript + TailwindCSS + Zustand + Framer Motion + Recharts
- API: ExpressJS + TypeScript + Prisma + PostgreSQL + Socket.IO
- Mobile: React Native Expo scaffold
- DevOps: Docker Compose + Render Blueprint
- Multi-tenant: mọi dữ liệu nghiệp vụ có `tenantId`

## Tài khoản demo sau khi seed

```txt
Super Admin:
Email: admin@possaas.vn
Password: Admin@123456

Chủ quán demo:
Email: owner@demo.vn
Password: Admin@123456
```

## Chạy local bằng Docker

```bash
cp .env.example .env
docker compose up --build
```

Mở:

```txt
Web: http://localhost:3000
API health: http://localhost:4000/health
```

## Chạy local không dùng Docker

Cần Node.js >= 20, PostgreSQL đã chạy sẵn.

```bash
npm install
cd apps/api
cp ../../.env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Mở terminal khác:

```bash
cd apps/web
npm install
npm run dev
```

## Deploy lên GitHub

```bash
git init
git add .
git commit -m "Initial POS SaaS MVP"
git branch -M main
git remote add origin https://github.com/USERNAME/pos-saas-platform.git
git push -u origin main
```

## Deploy lên Render bằng Blueprint

1. Push source này lên GitHub.
2. Vào Render Dashboard.
3. Chọn **New +** → **Blueprint**.
4. Chọn repository vừa push.
5. Render sẽ đọc file `render.yaml` ở thư mục gốc.
6. Deploy lần đầu.
7. Nếu Render tạo URL khác với mặc định, cập nhật lại biến môi trường:
   - `CORS_ORIGIN`
   - `WEB_URL`
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_SOCKET_URL`
8. Redeploy web sau khi đổi `NEXT_PUBLIC_*`.

## Module có sẵn trong MVP

- Đăng nhập JWT
- Seed Super Admin
- Seed tenant demo
- Quản lý tenant cơ bản
- Chi nhánh
- Khu vực / bàn
- Danh mục / sản phẩm
- POS tạo order
- Socket.IO realtime khi order mới
- Màn hình bếp nhận ticket realtime
- Thanh toán đơn giản
- Dashboard doanh thu
- Multi-tenant theo `tenantId`

## Lưu ý production

Bản này dùng `prisma db push` để dễ deploy lần đầu trên Render. Khi đưa vào kinh doanh thật, nên chuyển sang Prisma Migration chính thức:

```bash
npx prisma migrate dev --name init
npx prisma migrate deploy
```

Sau đó sửa `render.yaml` từ `npx prisma db push` sang `npx prisma migrate deploy`.

## Nâng cấp v2

Bản v2 đã thêm upload avatar, upload hình món, quản lý bàn/khu vực, giao diện admin nhiều theme, chuông báo khi bếp hoàn thành món và module kết ca/chốt tiền.

Trang mới:

```txt
/admin/tables
/settings/themes
/shifts
```

Khi nâng từ bản cũ, nên chạy:

```powershell
docker compose down -v --remove-orphans
docker rm -f pos_saas_redis pos_saas_postgres pos_saas_api pos_saas_web
docker builder prune -f
docker compose up --build
```

## Upgrade v4 Coffee/F&B SaaS

Bản này đã thêm các module nâng cấp:
- Inventory/Kho nguyên liệu
- CRM khách hàng
- AI insights
- QR Self-order scaffold
- Database extension cho topping/combo/voucher/membership/reservation/snapshot

Xem chi tiết tại:
- `UPGRADE-V4-COFFEE-FNB-SAAS.md`
- `docs/SAAS_FNB_V4_ARCHITECTURE.md`
- `docs/DATABASE_V4.md`
- `docs/API_V4.md`


## UPLOAD IMAGE FIX

Nếu upload ảnh thành công nhưng preview bị vỡ, nguyên nhân thường là trình duyệt chặn ảnh từ API khác port do header `Cross-Origin-Resource-Policy`. Bản này đã cấu hình `helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }})` và static `/uploads` có header mở để web `localhost:3000` hiển thị ảnh từ API `localhost:4000`.

Test nhanh sau khi upload: copy link ảnh dạng `http://localhost:4000/uploads/products/...` và mở trực tiếp trên trình duyệt. Nếu mở được ảnh thì preview trong web sẽ hiển thị.

## V8 - Thanh toán theo bàn + hóa đơn bill nhiệt

Bản v8 thêm workflow quán cà phê thực tế: chọn bàn → gọi món → cộng món vào bill đang mở của bàn → in tạm tính → thanh toán theo bàn → in hóa đơn nhiệt 80mm → trả bàn về trạng thái trống.

Trang in hóa đơn:

```txt
/print/invoice/[orderId]?type=temp
/print/invoice/[orderId]?type=paid
```

Xem chi tiết trong `UPGRADE-V8-TABLE-PAYMENT-THERMAL-RECEIPT.md`.

## V10 - Báo cáo doanh thu, QR thanh toán, chat nội bộ

Bản V10 bổ sung:
- Báo cáo doanh thu theo ngày/phương thức/top món, sửa lỗi lọc ngày kết thúc.
- Chủ quán upload QR thanh toán trong `/settings/themes`.
- Hóa đơn bill nhiệt in QR kèm mã hóa đơn và tổng tiền.
- Phòng chat công việc realtime tại `/chat`.

Sau khi nâng cấp nên chạy lại database sạch:

```bash
docker compose down -v --remove-orphans
docker compose up --build
```


## V11 - Thông tin quán & Excel báo cáo chuyên nghiệp

- Chủ quán vào `/settings/themes` để sửa tên quán, địa chỉ, số điện thoại.
- Báo cáo doanh thu xuất `.xlsx` thật, có kẻ khung, nhiều sheet và định dạng số liệu.
- Bảng lương cũng có xuất `.xlsx` có kẻ khung.

## Deploy Render bằng Dockerfile

Bản này hỗ trợ deploy bằng Dockerfile trên Render:

- API: `Dockerfile.api`
- Web: `Dockerfile.web`
- Default root: `Dockerfile` chạy API
- Blueprint: `render.yaml`

Xem hướng dẫn chi tiết trong `RENDER_DOCKER_DEPLOY_HAIORA.md`.
