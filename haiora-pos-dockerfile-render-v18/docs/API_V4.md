# API Structure v4

## Auth
- POST /auth/login
- POST /auth/register-tenant
- GET /auth/me
- PATCH /auth/profile

## Admin
- GET/POST/PATCH /users
- GET/POST /branches
- GET/POST /areas
- GET/POST/PATCH/DELETE /tables
- GET/POST/PATCH/DELETE /products
- GET/POST /categories

## POS
- GET /pos/bootstrap
- POST /pos/orders
- POST /pos/offline-sync
- GET /orders
- PATCH /pos/orders/:orderId/items/:itemId
- PATCH /pos/orders/:orderId/items/:itemId/price
- PATCH /pos/orders/:id/discount
- POST /pos/orders/:id/payment
- POST /pos/orders/:id/cancel
- PATCH /pos/orders/:id/change-table
- POST /pos/orders/:id/split-bill
- POST /pos/orders/:id/merge-bill
- POST /pos/orders/:id/print

## KDS
- GET /kitchen/tickets
- PATCH /kitchen/items/:id/status

## HR
- GET /hr/roles
- GET/POST /hr/work-shifts
- GET /hr/attendance
- POST /hr/attendance/check-in
- POST /hr/attendance/:id/check-out
- GET/POST /hr/commission-rules
- GET /hr/commissions

## Inventory & CRM v4
- GET /inventory/summary
- GET /inventory/ingredients
- POST /inventory/ingredients
- POST /inventory/movements
- GET /crm/customers
- POST /crm/customers
- GET /ai/insights

## Realtime events
- order.created
- order.paid
- order.ready
- table.status_changed
- kitchen.ticket_created
- kitchen.item_status_changed
