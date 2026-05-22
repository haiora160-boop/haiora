# HAIORA POS v20 - Mobile/PWA Upgrade

Bản này nâng cấp phần điện thoại:

## 1. Logo app trên điện thoại

Đã thêm các file PWA icon:

- `apps/web/public/manifest.json`
- `apps/web/public/icon-192.png`
- `apps/web/public/icon-512.png`
- `apps/web/public/maskable-icon-512.png`
- `apps/web/public/apple-touch-icon.png`
- `apps/web/public/favicon-16.png`
- `apps/web/public/favicon-32.png`
- `apps/web/public/sw.js`

Đã khai báo trong:

- `apps/web/app/layout.tsx`
- `apps/web/app/pwa-register.tsx`

## 2. Giao diện điện thoại dễ dùng hơn

Đã nâng cấp:

- Màn hình đăng nhập gọn hơn trên mobile.
- Ẩn phần hero lớn trên điện thoại để không bị tràn màn hình.
- Header app tối ưu chạm bằng tay.
- Thêm menu trượt cho điện thoại.
- Thêm thanh điều hướng dưới màn hình:
  - Bán hàng
  - Bếp
  - Tổng quan
  - Chat
  - Hồ sơ
- Tăng kích thước vùng chạm nút/input.
- Tối ưu safe-area cho iPhone tai thỏ.
- Cải thiện layout POS khi dùng trên điện thoại.

## 3. Expo mobile scaffold

Đã thêm icon cho app native Expo:

- `apps/mobile/assets/icon.png`
- `apps/mobile/assets/adaptive-icon.png`
- `apps/mobile/assets/splash-icon.png`

Đã cập nhật:

- `apps/mobile/app.json`
- `apps/mobile/app/index.tsx`

## 4. Cài app lên điện thoại

### iPhone

1. Mở Safari.
2. Vào link Web Render, ví dụ: `https://link-web.onrender.com/login`.
3. Bấm nút Chia sẻ.
4. Chọn **Thêm vào Màn hình chính**.
5. Bấm **Thêm**.

### Android

1. Mở Chrome.
2. Vào link Web Render.
3. Bấm dấu `⋮`.
4. Chọn **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính**.

Nếu icon chưa đổi, hãy xóa app cũ khỏi màn hình chính rồi thêm lại.

## 5. Render Docker

API vẫn dùng:

- `Dockerfile.api`

Web vẫn dùng:

- `Dockerfile.web`

Nếu Render đang dùng API `https://haiora-7d9x.onrender.com`, bản này đã đặt default build arg trong `Dockerfile.web` để web trỏ về API đó.

Nếu API của bạn đổi link, sửa trong Render Web service:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`

rồi deploy lại Web bằng **Clear build cache & deploy**.
