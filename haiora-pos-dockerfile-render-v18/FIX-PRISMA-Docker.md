# Fix Prisma Docker Build

Lỗi `The datasource property url is no longer supported in schema files` xảy ra vì npm cài `prisma@latest` nên kéo Prisma 7.x. Source MVP này đang dùng cú pháp Prisma 6 với `url = env("DATABASE_URL")` trong `schema.prisma`.

Đã sửa bằng cách khóa phiên bản:

- `prisma`: `6.19.0`
- `@prisma/client`: `6.19.0`
- Next.js/Tailwind/React cũng được khóa version ổn định để build Docker và Render ít lỗi hơn.

Chạy lại:

```powershell
docker compose down -v
docker builder prune -f
docker compose up --build
```
