# Kiến trúc POS SaaS Platform

```mermaid
flowchart TD
  Web[Next.js Web Admin/POS] --> API[Express API]
  Mobile[React Native Expo] --> API
  API --> PG[(PostgreSQL)]
  API --> Redis[(Redis optional)]
  API <--> Socket[Socket.IO Realtime]
  Socket --> Kitchen[Màn hình bếp/bar]
  Socket --> POS[POS thu ngân]
```

## Multi-tenant

Bản MVP dùng mô hình shared database/shared schema. Các bảng nghiệp vụ có `tenantId` để cô lập dữ liệu từng khách thuê.

## Module chính

- Auth JWT
- Super Admin
- Tenant / Branch
- Area / Table
- Product / Category
- POS Order
- Kitchen Display
- Payment
- Report Dashboard
- Mobile scaffold

## Mở rộng tiếp

- RBAC chi tiết bằng bảng Role/Permission
- Prisma Migration production
- Redis Adapter cho Socket.IO khi scale nhiều instance
- Inventory tự trừ kho theo Recipe
- QR Order cho khách hàng
- CRM/Zalo/SMS/Email
- AI dự đoán doanh thu và nhập hàng
