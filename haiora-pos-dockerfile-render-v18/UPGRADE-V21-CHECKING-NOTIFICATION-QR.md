# HAIORA POS v21 - Checking nhân viên, đồng bộ giao diện, thông báo realtime và QR thu tiền

## Tính năng nâng cấp

1. **Tài khoản nhân viên Checking để chấm công**
   - Trang mới: `/attendance`
   - Nhân viên tự chấm vào/chấm ra trên điện thoại.
   - Hiển thị ca làm, giờ vào, giờ ra, tổng thời gian làm và lịch sử gần đây.
   - Chủ quán/quản lý vẫn xem tổng ở `/admin/hr`.

2. **Chỉ Chủ quán xem báo cáo và thay đổi giao diện**
   - Menu Báo cáo chỉ hiển thị với tài khoản `OWNER`.
   - API báo cáo yêu cầu quyền `OWNER`.
   - Trang `/settings/themes` chỉ cho Chủ quán lưu theme/slogan/QR/thông tin quán.

3. **Giao diện đồng bộ toàn bộ tài khoản**
   - Thêm `adminTheme` vào Tenant.
   - Khi Chủ quán đổi giao diện, server phát realtime event `settings.branding_updated`.
   - Tất cả tài khoản đang online tự đổi theme theo Chủ quán.

4. **Chat có báo tin nhắn mới**
   - Khi có tin nhắn chung hoặc riêng, người nhận có banner thông báo.
   - Có badge số tin chưa đọc ở icon chuông/chat.
   - Có âm báo ngắn; nếu trình duyệt cho phép sẽ có notification hệ thống.

5. **Bếp/bar hoàn thành món có chuông báo**
   - Khi bếp bấm `Hoàn thành` và ticket/order đã xong, các tài khoản cùng chi nhánh nhận event `order.ready` / `kitchen.order_ready`.
   - AppShell phát âm báo và hiển thị banner.

6. **Tài khoản order mở QR tính tiền cho khách quét**
   - Trong POS có nút `QR` tại bill bàn đang chọn.
   - Danh sách bill chờ thanh toán có nút `QR`.
   - QR lấy từ hóa đơn, ưu tiên QR động VietQR theo số tiền bill.

## File chính đã chỉnh

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/src/index.ts`
- `apps/web/components/app-shell.tsx`
- `apps/web/app/settings/themes/page.tsx`
- `apps/web/app/reports/page.tsx`
- `apps/web/app/pos/page.tsx`
- `apps/web/app/attendance/page.tsx`

## Deploy Render

API Docker:

```txt
Dockerfile Path: Dockerfile.api
Docker Build Context Directory: .
```

Web Docker:

```txt
Dockerfile Path: Dockerfile.web
Docker Build Context Directory: .
```

Nếu repo còn lồng trong thư mục `haiora-pos-dockerfile-render-v21...`, thì Docker Build Context phải là thư mục đó.

Sau khi upload bản mới lên GitHub, deploy lại:

1. `haiora-api` → Manual Deploy
2. `haiora-web` → Manual Deploy → Clear build cache & deploy

