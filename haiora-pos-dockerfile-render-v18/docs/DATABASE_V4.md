# Database Design v4

## Core SaaS
- Tenant, Branch, User, AuditLog.
- Multi-tenant bằng `tenantId`.

## POS
- Area, DiningTable, Order, OrderItem, Payment, KitchenTicket, KitchenTicketItem, ShiftSession, OfflineSyncLog.

## Menu
- Category, Product, ProductVariant.
- Bản v4 bổ sung hướng thiết kế cho Topping/Combo/PriceBook trong docs và có thể mở rộng trong Prisma.

## Inventory
- Ingredient, Recipe, RecipeItem, StockMovement.
- Module UI mới hiển thị tồn kho thấp và lịch sử nhập/xuất.

## HR
- WorkShift, AttendanceRecord, CommissionRule, CommissionRecord.

## CRM
- Customer, points hiện có.
- Roadmap: CustomerTier, Voucher, CustomerVoucher, Campaign, ZaloMessage.

## Báo cáo
Hiện dashboard đọc trực tiếp từ order/payment. Khi dữ liệu lớn nên thêm snapshot:
- DailyRevenueSnapshot
- HourlySalesSnapshot
- ProductSalesSnapshot
- StaffPerformanceSnapshot
