import { PrismaClient, UserRole, TenantStatus, TableStatus, CommissionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const superEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@possaas.vn';
  const superPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456';
  const passwordHash = await bcrypt.hash(superPassword, 10);

  await prisma.user.upsert({
    where: { email: superEmail },
    update: {},
    create: {
      fullName: 'Super Admin',
      email: superEmail,
      avatarUrl: 'https://api.dicebear.com/8.x/initials/svg?seed=Super%20Admin',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { code: 'DEMO-CAFE' },
    update: {
      appName: 'stype pos',
      slogans: ['Bán hàng nhanh hơn mỗi ca', 'Order chuẩn – Chốt tiền rõ', 'Quản lý quán gọn trong một màn hình'],
      commissionMinSales: 100000,
      receiptHeaderLine: 'In bởi stype pos',
      receiptShopName: 'KING COFFEE',
      receiptShopAddress: 'Quận 1, TP.HCM',
      receiptShopPhone: '0900000000',
      receiptFooterNote: 'Quý khách vui lòng kiểm tra lại hóa đơn\ntrước khi thanh toán.\nXin cảm ơn quý khách.\nHẹn gặp lại quý khách lần sau.',
      paymentQrBankCode: '',
      paymentQrAccountNo: '',
      paymentQrAccountName: '',
      paymentQrTemplate: 'compact2',
    },
    create: {
      name: 'Demo Coffee & POS',
      code: 'DEMO-CAFE',
      phone: '0900000000',
      email: 'owner@demo.vn',
      address: 'TP.HCM',
      status: TenantStatus.ACTIVE,
      appName: 'stype pos',
      slogans: ['Bán hàng nhanh hơn mỗi ca', 'Order chuẩn – Chốt tiền rõ', 'Quản lý quán gọn trong một màn hình'],
      commissionMinSales: 100000,
      receiptHeaderLine: 'In bởi stype pos',
      receiptShopName: 'KING COFFEE',
      receiptShopAddress: 'Quận 1, TP.HCM',
      receiptShopPhone: '0900000000',
      receiptFooterNote: 'Quý khách vui lòng kiểm tra lại hóa đơn\ntrước khi thanh toán.\nXin cảm ơn quý khách.\nHẹn gặp lại quý khách lần sau.',
      paymentQrBankCode: '',
      paymentQrAccountNo: '',
      paymentQrAccountName: '',
      paymentQrTemplate: 'compact2',
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: 'demo-branch-001' },
    update: {},
    create: {
      id: 'demo-branch-001',
      tenantId: tenant.id,
      name: 'Chi nhánh trung tâm',
      phone: '0900000000',
      address: 'Quận 1, TP.HCM',
    },
  });

  await prisma.user.upsert({
    where: { email: 'owner@demo.vn' },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      fullName: 'Chủ quán demo',
      email: 'owner@demo.vn',
      avatarUrl: 'https://api.dicebear.com/8.x/initials/svg?seed=Chu%20Quan',
      phone: '0900000000',
      passwordHash,
      role: UserRole.OWNER,
      allowCancelBill: true,
      allowDiscount: true,
      allowEditPrice: true,
      allowPayments: true,
      salaryPerHour: 50000,
    },
  });

  await prisma.user.upsert({
    where: { email: 'order@demo.vn' },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      fullName: 'Nhân viên order',
      email: 'order@demo.vn',
      phone: '0911111111',
      avatarUrl: 'https://api.dicebear.com/8.x/initials/svg?seed=Order',
      passwordHash,
      role: UserRole.WAITER,
      employeeCode: 'NV-ORDER-01',
      position: 'Phục vụ / order tại bàn',
      salaryPerShift: 180000,
      salaryPerHour: 25000,
      commissionRate: 1,
    },
  });

  await prisma.user.upsert({
    where: { email: 'cashier@demo.vn' },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      fullName: 'Thu ngân demo',
      email: 'cashier@demo.vn',
      phone: '0922222222',
      avatarUrl: 'https://api.dicebear.com/8.x/initials/svg?seed=Cashier',
      passwordHash,
      role: UserRole.CASHIER,
      employeeCode: 'NV-CASHIER-01',
      position: 'Thu ngân',
      salaryPerShift: 220000,
      salaryPerHour: 30000,
      commissionRate: 1.5,
      allowDiscount: true,
      allowPayments: true,
    },
  });


  await prisma.workShift.upsert({
    where: { id: 'demo-shift-morning' },
    update: {},
    create: {
      id: 'demo-shift-morning',
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Ca sáng',
      startTime: '07:00',
      endTime: '14:00',
      color: 'from-sky-500 to-indigo-600',
    },
  });

  await prisma.workShift.upsert({
    where: { id: 'demo-shift-evening' },
    update: {},
    create: {
      id: 'demo-shift-evening',
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Ca tối',
      startTime: '14:00',
      endTime: '22:00',
      color: 'from-pink-500 to-orange-500',
    },
  });

  await prisma.commissionRule.upsert({
    where: { id: 'demo-commission-cashier' },
    update: {},
    create: {
      id: 'demo-commission-cashier',
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Thu ngân 1.5% doanh số thanh toán',
      role: UserRole.CASHIER,
      type: CommissionType.PERCENT_OF_SALES,
      value: 1.5,
    },
  });

  await prisma.commissionRule.upsert({
    where: { id: 'demo-commission-waiter' },
    update: {},
    create: {
      id: 'demo-commission-waiter',
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Phục vụ 1% đơn hoàn tất',
      role: UserRole.WAITER,
      type: CommissionType.PERCENT_OF_SALES,
      value: 1,
    },
  });

  const area = await prisma.area.upsert({
    where: { id: 'demo-area-001' },
    update: {},
    create: {
      id: 'demo-area-001',
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Tầng 1',
      sortOrder: 1,
    },
  });

  for (let i = 1; i <= 12; i++) {
    await prisma.diningTable.upsert({
      where: { id: `demo-table-${String(i).padStart(3, '0')}` },
      update: {},
      create: {
        id: `demo-table-${String(i).padStart(3, '0')}`,
        tenantId: tenant.id,
        branchId: branch.id,
        areaId: area.id,
        name: `Bàn ${i}`,
        capacity: i <= 4 ? 2 : 4,
        status: TableStatus.AVAILABLE,
      },
    });
  }

  const drinks = await prisma.category.upsert({
    where: { id: 'demo-cat-drinks' },
    update: {},
    create: { id: 'demo-cat-drinks', tenantId: tenant.id, name: 'Đồ uống', sortOrder: 1 },
  });

  const food = await prisma.category.upsert({
    where: { id: 'demo-cat-food' },
    update: {},
    create: { id: 'demo-cat-food', tenantId: tenant.id, name: 'Món ăn', sortOrder: 2 },
  });

  const products = [
    ['CF-SUA', 'Cà phê sữa', 'Cà phê truyền thống', 30000, drinks.id, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800&auto=format&fit=crop'],
    ['BAC-XIU', 'Bạc xỉu', 'Bạc xỉu đá', 35000, drinks.id, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=800&auto=format&fit=crop'],
    ['TRA-DAO', 'Trà đào cam sả', 'Trà đào size M', 45000, drinks.id, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=800&auto=format&fit=crop'],
    ['SINH-TO', 'Sinh tố bơ', 'Sinh tố tươi', 50000, drinks.id, 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?q=80&w=800&auto=format&fit=crop'],
    ['MY-XAO', 'Mì xào bò', 'Mì xào nóng', 65000, food.id, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800&auto=format&fit=crop'],
    ['COMBO-01', 'Combo cafe + bánh', 'Combo bán chạy', 59000, food.id, 'https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=800&auto=format&fit=crop'],
  ] as const;

  for (const [sku, name, description, price, categoryId, imageUrl] of products) {
    await prisma.product.upsert({
      where: { id: `demo-product-${sku.toLowerCase()}` },
      update: {},
      create: {
        id: `demo-product-${sku.toLowerCase()}`,
        tenantId: tenant.id,
        categoryId,
        sku,
        name,
        description,
        imageUrl,
        price,
        costPrice: Math.round(Number(price) * 0.45),
      },
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
