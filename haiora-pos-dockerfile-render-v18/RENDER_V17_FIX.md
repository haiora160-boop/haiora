# HAIORA POS v17 Render No-TSC Fix

Bản này sửa lỗi Render API build do TypeScript/Prisma type-check bằng cách chạy API bằng tsx thay vì compile tsc.

## Cấu trúc đúng trên GitHub

Ngoài cùng repo phải có:

- apps/
- render.yaml
- package.json
- docker-compose.yml
- .env.example

## Render Blueprint

Dùng New + -> Blueprint -> chọn repo.

## Nếu tạo thủ công

API:
Root Directory: apps/api
Build Command:
`npm install --workspaces=false --include=dev --legacy-peer-deps && npx prisma@6.19.0 generate`
Start Command:
`npx prisma@6.19.0 db push && npm run db:seed && npm run start`

Web:
Root Directory: apps/web
Build Command:
`npm install --workspaces=false --include=dev --legacy-peer-deps && npm run build`
Start Command:
`npm run start`
