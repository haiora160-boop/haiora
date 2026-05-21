# Fix API Cannot find module /app/dist/index.js

Nguyên nhân: `tsconfig.json` trước đó để `rootDir` là `.` và include cả `prisma/seed.ts`, nên TypeScript build file API thành `dist/src/index.js` thay vì `dist/index.js`. Docker lại chạy `node dist/index.js`, dẫn tới lỗi MODULE_NOT_FOUND.

Bản này đã sửa `apps/api/tsconfig.json`:

- `rootDir`: `src`
- `include`: chỉ build `src/**/*.ts`
- Kết quả build đúng: `dist/index.js`

Sau khi giải nén bản này, chạy lại:

```powershell
docker compose down -v
docker builder prune -f
docker compose up --build
```
