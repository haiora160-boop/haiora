import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AttendanceStatus, CommissionType, OrderStatus, PaymentMethod, PaymentStatus, ShiftStatus, TableStatus, UserRole } from '@prisma/client';
import { prisma } from './prisma';
import { getBranchId, getTenantId, requireAuth, requireRoles, signToken } from './auth';
import { emitToBranch, emitToKitchen, emitToTenant, emitToUser, initSocket } from './socket';

const app = express();
const server = http.createServer(app);
initSocket(server);

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedDevOrigin(origin?: string) {
  if (!origin) return true;
  if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
}

app.use(helmet({
  // Cho phép web ở localhost:3000 / domain frontend hiển thị ảnh upload từ API :4000.
  // Nếu giữ mặc định same-origin, trình duyệt sẽ chặn <img src="http://localhost:4000/uploads/..."> và preview bị vỡ.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedDevOrigin(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '12mb' }));
const uploadRoot = path.join(process.cwd(), 'uploads');

function buildPublicUploadUrl(req: express.Request, publicPath: string) {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL || process.env.API_PUBLIC_URL;
  if (configured) return `${configured.replace(/\/$/, '')}${publicPath}`;
  return `${req.protocol}://${req.get('host')}${publicPath}`;
}

app.use('/uploads', express.static(uploadRoot, {
  setHeaders: (res) => {
    // Ảnh upload được frontend render từ domain/port khác nên cần mở CORP/CORS cho static file.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 60_000, limit: 240 }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'pos-saas-api', time: new Date().toISOString() });
});


async function writeAudit(req: express.Request, action: string, module: string, metadata?: unknown) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: req.user?.tenantId || null,
        userId: req.user?.sub || null,
        action,
        module,
        metadata: (metadata || {}) as any,
      },
    });
  } catch (error) {
    console.error('audit log failed', error);
  }
}

function hasRole(role: UserRole, roles: UserRole[]) {
  return roles.includes(role);
}

async function canDo(req: express.Request, permission: 'cancelBill' | 'discount' | 'editPrice' | 'payments') {
  if (!req.user) return false;
  // V7: mọi tài khoản trong quán đều được phép thu tiền/thanh toán.
  // Các thao tác chỉnh sửa nhạy cảm như hủy bill, giảm giá, sửa giá chỉ dành cho Chủ quán/Super Admin.
  if (permission === 'payments') return true;
  if (hasRole(req.user.role, [UserRole.OWNER, UserRole.SUPER_ADMIN])) return true;
  return false;
}

function normalizeSlogans(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
  }
  return [];
}

function money(value: unknown) {
  return Number(value || 0);
}

function parseDateInput(value: unknown, fallback: Date) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function reportDateRange(fromValue: unknown, toValue: unknown) {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const from = parseDateInput(fromValue, defaultFrom);
  let to = parseDateInput(toValue, new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  if (typeof toValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(toValue)) {
    to = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  }
  return { from, to };
}

function monthRange(month?: string) {
  const now = new Date();
  const matched = typeof month === 'string' ? month.match(/^(\d{4})-(\d{2})$/) : null;
  const year = matched ? Number(matched[1]) : now.getFullYear();
  const monthIndex = matched ? Number(matched[2]) - 1 : now.getMonth();
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  return { start, end, label: `${year}-${String(monthIndex + 1).padStart(2, '0')}` };
}

async function createOrderFromPayload(req: express.Request, payload: { branchId: string; tableId?: string | null; note?: string; items: Array<{ productId: string; quantity: number; note?: string }> }) {
  const tenantId = getTenantId(req);
  const created = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { tenantId, id: { in: payload.items.map((i) => i.productId) } },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const newSubtotal = payload.items.reduce((sum, item) => {
      const product = byId.get(item.productId);
      if (!product) throw new Error('Sản phẩm không tồn tại trong tenant này');
      return sum + money(product.price) * item.quantity;
    }, 0);

    // V8: 1 bàn chỉ có 1 order đang mở. Nếu bàn đã có order chưa thanh toán thì cộng món vào order đó.
    const openOrder = payload.tableId
      ? await tx.order.findFirst({
          where: {
            tenantId,
            branchId: payload.branchId,
            tableId: payload.tableId,
            paymentStatus: { not: PaymentStatus.PAID },
            status: { notIn: [OrderStatus.PAID, OrderStatus.CANCELLED] },
          },
          include: { items: true, table: true },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    let order;
    if (openOrder) {
      await tx.orderItem.createMany({
        data: payload.items.map((item) => {
          const product = byId.get(item.productId)!;
          return {
            orderId: openOrder.id,
            productId: item.productId,
            name: product.name,
            quantity: item.quantity,
            price: product.price,
            total: money(product.price) * item.quantity,
            note: item.note,
          };
        }),
      });
      const nextSubtotal = Number(openOrder.subtotal || 0) + newSubtotal;
      order = await tx.order.update({
        where: { id: openOrder.id },
        data: {
          subtotal: nextSubtotal,
          total: Math.max(nextSubtotal - Number(openOrder.discount || 0), 0),
          note: [openOrder.note, payload.note].filter(Boolean).join(' · ') || undefined,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          serviceType: payload.tableId ? 'DINE_IN' : 'TAKE_AWAY',
        },
        include: { items: true, table: true },
      });
    } else {
      const code = `OD${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
      order = await tx.order.create({
        data: {
          tenantId,
          branchId: payload.branchId,
          tableId: payload.tableId || undefined,
          cashierId: req.user!.sub,
          code,
          note: payload.note,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          serviceType: payload.tableId ? 'DINE_IN' : 'TAKE_AWAY',
          subtotal: newSubtotal,
          total: newSubtotal,
          items: {
            create: payload.items.map((item) => {
              const product = byId.get(item.productId)!;
              return {
                productId: item.productId,
                name: product.name,
                quantity: item.quantity,
                price: product.price,
                total: money(product.price) * item.quantity,
                note: item.note,
              };
            }),
          },
        },
        include: { items: true, table: true },
      });
    }

    if (payload.tableId) {
      await tx.diningTable.update({ where: { id: payload.tableId }, data: { status: TableStatus.OCCUPIED } });
    }

    const ticket = await tx.kitchenTicket.create({
      data: {
        tenantId,
        branchId: payload.branchId,
        orderId: order.id,
        station: 'BEP',
        items: { create: payload.items.map((item) => {
          const product = byId.get(item.productId)!;
          return { name: product.name, quantity: item.quantity, note: item.note };
        }) },
      },
      include: { items: true, order: true },
    });
    return { order, ticket, merged: Boolean(openOrder) };
  });
  emitToBranch(payload.branchId, created.merged ? 'order.updated' : 'order.created', created.order);
  emitToKitchen(payload.branchId, 'kitchen.ticket_created', created.ticket);
  if (payload.tableId) emitToBranch(payload.branchId, 'table.status_changed', { id: payload.tableId, status: TableStatus.OCCUPIED });
  await writeAudit(req, created.merged ? 'ADD_ITEMS_TO_TABLE_ORDER' : 'CREATE_ORDER', 'POS', { orderId: created.order.id, code: created.order.code, total: created.order.total, tableId: payload.tableId || null });
  return created;
}


app.post('/uploads/image', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      folder: z.enum(['avatars', 'products', 'general', 'qrcodes']).default('general'),
      fileName: z.string().optional(),
      dataUrl: z.string().min(20),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'File upload không hợp lệ' });

    const matched = parsed.data.dataUrl.match(/^data:(image\/(png|jpe?g|webp|gif|svg\+xml));base64,(.+)$/i);
    if (!matched) return res.status(400).json({ message: 'Chỉ hỗ trợ ảnh PNG, JPG, WEBP, GIF hoặc SVG' });

    const mime = matched[1].toLowerCase();
    const rawExt = matched[2].toLowerCase();
    const ext = rawExt.includes('jpeg') ? 'jpg' : rawExt.includes('svg') ? 'svg' : rawExt;
    const buffer = Buffer.from(matched[3], 'base64');
    if (buffer.length > 4 * 1024 * 1024) return res.status(400).json({ message: 'Ảnh tối đa 4MB' });

    const safeTenant = req.user?.tenantId || 'system';
    const dir = path.join(uploadRoot, parsed.data.folder, safeTenant);
    await fs.mkdir(dir, { recursive: true });
    const safeName = (parsed.data.fileName || 'upload')
      .replace(/\.[^/.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 48) || 'upload';
    const fileName = `${Date.now()}-${safeName}.${ext}`;
    const absolutePath = path.join(dir, fileName);
    await fs.writeFile(absolutePath, buffer);

    const publicPath = `/uploads/${parsed.data.folder}/${safeTenant}/${fileName}`;
    const url = buildPublicUploadUrl(req, publicPath);
    res.status(201).json({ url, path: publicPath, mime, size: buffer.length });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Không upload được ảnh' });
  }
});

app.post('/auth/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu đăng nhập không hợp lệ' });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });

  const token = signToken({
    sub: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    email: user.email,
    role: user.role,
  });

  res.json({
    accessToken: token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      tenantId: user.tenantId,
      branchId: user.branchId,
    },
  });
});


app.get('/settings/branding', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, address: true, phone: true, appName: true, slogans: true, commissionMinSales: true, paymentQrUrl: true, paymentQrNote: true, paymentQrBankCode: true, paymentQrAccountNo: true, paymentQrAccountName: true, paymentQrTemplate: true, receiptHeaderLine: true, receiptShopName: true, receiptShopAddress: true, receiptShopPhone: true, receiptFooterNote: true },
    });
    res.json({
      shopName: tenant?.name || '',
      shopAddress: tenant?.address || '',
      shopPhone: tenant?.phone || '',
      appName: tenant?.appName || 'stype pos',
      slogans: normalizeSlogans(tenant?.slogans).length ? normalizeSlogans(tenant?.slogans) : ['Bán hàng nhanh – Chốt ca chuẩn', 'Order mượt – Báo cáo rõ'],
      commissionMinSales: Number(tenant?.commissionMinSales || 0),
      paymentQrUrl: tenant?.paymentQrUrl || '',
      paymentQrNote: tenant?.paymentQrNote || '',
      paymentQrBankCode: tenant?.paymentQrBankCode || '',
      paymentQrAccountNo: tenant?.paymentQrAccountNo || '',
      paymentQrAccountName: tenant?.paymentQrAccountName || '',
      paymentQrTemplate: tenant?.paymentQrTemplate || 'compact2',
      receiptHeaderLine: tenant?.receiptHeaderLine || `In bởi ${tenant?.appName || 'stype pos'}`,
      receiptShopName: tenant?.receiptShopName || tenant?.name || '',
      receiptShopAddress: tenant?.receiptShopAddress || tenant?.address || '',
      receiptShopPhone: tenant?.receiptShopPhone || tenant?.phone || '',
      receiptFooterNote: tenant?.receiptFooterNote || 'Quý khách vui lòng kiểm tra lại hóa đơn\ntrước khi thanh toán.\nXin cảm ơn quý khách.\nHẹn gặp lại quý khách lần sau.',
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/settings/branding', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({
      shopName: z.string().min(2).max(120).optional(),
      shopAddress: z.string().max(240).optional().nullable(),
      shopPhone: z.string().max(40).optional().nullable(),
      appName: z.string().min(2).max(40).optional(),
      slogans: z.array(z.string().max(120)).max(8).optional(),
      commissionMinSales: z.number().nonnegative().optional(),
      paymentQrUrl: z.string().max(500).optional().nullable(),
      paymentQrNote: z.string().max(160).optional().nullable(),
      paymentQrBankCode: z.string().max(40).optional().nullable(),
      paymentQrAccountNo: z.string().max(40).optional().nullable(),
      paymentQrAccountName: z.string().max(120).optional().nullable(),
      paymentQrTemplate: z.string().max(40).optional().nullable(),
      receiptHeaderLine: z.string().max(120).optional().nullable(),
      receiptShopName: z.string().max(120).optional().nullable(),
      receiptShopAddress: z.string().max(240).optional().nullable(),
      receiptShopPhone: z.string().max(40).optional().nullable(),
      receiptFooterNote: z.string().max(600).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu cài đặt không hợp lệ' });
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(parsed.data.shopName !== undefined ? { name: parsed.data.shopName.trim() } : {}),
        ...(parsed.data.shopAddress !== undefined ? { address: parsed.data.shopAddress ? parsed.data.shopAddress.trim() : null } : {}),
        ...(parsed.data.shopPhone !== undefined ? { phone: parsed.data.shopPhone ? parsed.data.shopPhone.trim() : null } : {}),
        ...(parsed.data.appName !== undefined ? { appName: parsed.data.appName.trim() } : {}),
        ...(parsed.data.slogans !== undefined ? { slogans: normalizeSlogans(parsed.data.slogans) } : {}),
        ...(parsed.data.commissionMinSales !== undefined ? { commissionMinSales: parsed.data.commissionMinSales } : {}),
        ...(parsed.data.paymentQrUrl !== undefined ? { paymentQrUrl: parsed.data.paymentQrUrl ? parsed.data.paymentQrUrl.trim() : null } : {}),
        ...(parsed.data.paymentQrNote !== undefined ? { paymentQrNote: parsed.data.paymentQrNote ? parsed.data.paymentQrNote.trim() : null } : {}),
        ...(parsed.data.paymentQrBankCode !== undefined ? { paymentQrBankCode: parsed.data.paymentQrBankCode ? parsed.data.paymentQrBankCode.trim() : null } : {}),
        ...(parsed.data.paymentQrAccountNo !== undefined ? { paymentQrAccountNo: parsed.data.paymentQrAccountNo ? parsed.data.paymentQrAccountNo.replace(/\s+/g, '').trim() : null } : {}),
        ...(parsed.data.paymentQrAccountName !== undefined ? { paymentQrAccountName: parsed.data.paymentQrAccountName ? parsed.data.paymentQrAccountName.trim() : null } : {}),
        ...(parsed.data.paymentQrTemplate !== undefined ? { paymentQrTemplate: parsed.data.paymentQrTemplate ? parsed.data.paymentQrTemplate.trim() : 'compact2' } : {}),
        ...(parsed.data.receiptHeaderLine !== undefined ? { receiptHeaderLine: parsed.data.receiptHeaderLine ? parsed.data.receiptHeaderLine.trim() : null } : {}),
        ...(parsed.data.receiptShopName !== undefined ? { receiptShopName: parsed.data.receiptShopName ? parsed.data.receiptShopName.trim() : null } : {}),
        ...(parsed.data.receiptShopAddress !== undefined ? { receiptShopAddress: parsed.data.receiptShopAddress ? parsed.data.receiptShopAddress.trim() : null } : {}),
        ...(parsed.data.receiptShopPhone !== undefined ? { receiptShopPhone: parsed.data.receiptShopPhone ? parsed.data.receiptShopPhone.trim() : null } : {}),
        ...(parsed.data.receiptFooterNote !== undefined ? { receiptFooterNote: parsed.data.receiptFooterNote ? parsed.data.receiptFooterNote.trim() : null } : {}),
      },
      select: { name: true, address: true, phone: true, appName: true, slogans: true, commissionMinSales: true, paymentQrUrl: true, paymentQrNote: true, paymentQrBankCode: true, paymentQrAccountNo: true, paymentQrAccountName: true, paymentQrTemplate: true, receiptHeaderLine: true, receiptShopName: true, receiptShopAddress: true, receiptShopPhone: true, receiptFooterNote: true },
    });
    await writeAudit(req, 'UPDATE_BRANDING_SETTINGS', 'SETTINGS', updated);
    res.json({
      shopName: updated.name,
      shopAddress: updated.address || '',
      shopPhone: updated.phone || '',
      appName: updated.appName,
      slogans: normalizeSlogans(updated.slogans),
      commissionMinSales: Number(updated.commissionMinSales || 0),
      paymentQrUrl: updated.paymentQrUrl || '',
      paymentQrNote: updated.paymentQrNote || '',
      paymentQrBankCode: updated.paymentQrBankCode || '',
      paymentQrAccountNo: updated.paymentQrAccountNo || '',
      paymentQrAccountName: updated.paymentQrAccountName || '',
      paymentQrTemplate: updated.paymentQrTemplate || 'compact2',
      receiptHeaderLine: updated.receiptHeaderLine || `In bởi ${updated.appName || 'stype pos'}`,
      receiptShopName: updated.receiptShopName || updated.name,
      receiptShopAddress: updated.receiptShopAddress || updated.address || '',
      receiptShopPhone: updated.receiptShopPhone || updated.phone || '',
      receiptFooterNote: updated.receiptFooterNote || 'Quý khách vui lòng kiểm tra lại hóa đơn\ntrước khi thanh toán.\nXin cảm ơn quý khách.\nHẹn gặp lại quý khách lần sau.',
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/auth/register-tenant', async (req, res) => {
  const schema = z.object({
    businessName: z.string().min(2),
    ownerName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    password: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu đăng ký không hợp lệ' });

  const code = parsed.data.businessName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toUpperCase()
    .slice(0, 18) + '-' + Math.floor(Math.random() * 9999);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: parsed.data.businessName,
        code,
        email: parsed.data.email,
        phone: parsed.data.phone,
        status: 'TRIAL',
      },
    });
    const branch = await tx.branch.create({
      data: { tenantId: tenant.id, name: 'Chi nhánh chính', phone: parsed.data.phone },
    });
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        fullName: parsed.data.ownerName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        passwordHash,
        role: UserRole.OWNER,
      },
    });
    return { tenant, branch, user };
  });

  res.status(201).json({ tenant: result.tenant, branch: result.branch });
});

app.get('/auth/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true, tenantId: true, branchId: true, salaryPerHour: true, salaryPerShift: true, commissionRate: true },
  });
  res.json(user);
});

app.patch('/auth/profile', requireAuth, async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().optional().nullable(),
    avatarUrl: z.string().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Thông tin cá nhân không hợp lệ' });

  const user = await prisma.user.update({
    where: { id: req.user!.sub },
    data: {
      ...(parsed.data.fullName !== undefined ? { fullName: parsed.data.fullName } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl || null } : {}),
    },
    select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true, tenantId: true, branchId: true },
  });
  res.json(user);
});

app.get('/users', requireAuth, requireRoles(UserRole.OWNER, UserRole.MANAGER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, employeeCode: true, position: true, salaryPerShift: true, salaryPerHour: true, commissionRate: true, allowCancelBill: true, allowDiscount: true, allowEditPrice: true, allowPayments: true, role: true, status: true, branchId: true, branch: { select: { name: true } }, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/users', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      avatarUrl: z.string().optional(),
      employeeCode: z.string().optional(),
      position: z.string().optional(),
      salaryPerShift: z.number().nonnegative().optional(),
      salaryPerHour: z.number().nonnegative().optional(),
      commissionRate: z.number().nonnegative().optional(),
      allowCancelBill: z.boolean().optional(),
      allowDiscount: z.boolean().optional(),
      allowEditPrice: z.boolean().optional(),
      allowPayments: z.boolean().optional(),
      password: z.string().min(6),
      branchId: z.string().optional(),
      role: z.nativeEnum(UserRole),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu tài khoản không hợp lệ' });
    if (parsed.data.role === UserRole.SUPER_ADMIN) return res.status(403).json({ message: 'Không được tạo Super Admin từ trang quán' });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        tenantId,
        branchId: parsed.data.branchId || req.user!.branchId || null,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        avatarUrl: parsed.data.avatarUrl,
        employeeCode: parsed.data.employeeCode,
        position: parsed.data.position,
        salaryPerShift: parsed.data.salaryPerShift,
        salaryPerHour: parsed.data.salaryPerHour,
        commissionRate: parsed.data.commissionRate,
        allowCancelBill: parsed.data.allowCancelBill ?? hasRole(parsed.data.role, [UserRole.OWNER, UserRole.MANAGER]),
        allowDiscount: parsed.data.allowDiscount ?? hasRole(parsed.data.role, [UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER]),
        allowEditPrice: parsed.data.allowEditPrice ?? hasRole(parsed.data.role, [UserRole.OWNER, UserRole.MANAGER]),
        allowPayments: parsed.data.allowPayments ?? hasRole(parsed.data.role, [UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER]),
        passwordHash,
        role: parsed.data.role,
      },
      select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, employeeCode: true, position: true, salaryPerShift: true, salaryPerHour: true, commissionRate: true, allowCancelBill: true, allowDiscount: true, allowEditPrice: true, allowPayments: true, role: true, status: true, branchId: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.code === 'P2002' ? 'Email đã tồn tại' : error.message });
  }
});

app.patch('/users/:id', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({
      fullName: z.string().min(2).optional(),
      phone: z.string().optional().nullable(),
      avatarUrl: z.string().optional().nullable(),
      employeeCode: z.string().optional().nullable(),
      position: z.string().optional().nullable(),
      salaryPerShift: z.number().nonnegative().optional().nullable(),
      salaryPerHour: z.number().nonnegative().optional().nullable(),
      commissionRate: z.number().nonnegative().optional().nullable(),
      allowCancelBill: z.boolean().optional(),
      allowDiscount: z.boolean().optional(),
      allowEditPrice: z.boolean().optional(),
      allowPayments: z.boolean().optional(),
      branchId: z.string().optional().nullable(),
      role: z.nativeEnum(UserRole).optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
      password: z.string().min(6).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu cập nhật tài khoản không hợp lệ' });
    if (parsed.data.role === UserRole.SUPER_ADMIN) return res.status(403).json({ message: 'Không được gán quyền Super Admin' });

    const exists = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!exists) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.fullName !== undefined ? { fullName: parsed.data.fullName } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
        ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl || null } : {}),
        ...(parsed.data.employeeCode !== undefined ? { employeeCode: parsed.data.employeeCode || null } : {}),
        ...(parsed.data.position !== undefined ? { position: parsed.data.position || null } : {}),
        ...(parsed.data.salaryPerShift !== undefined ? { salaryPerShift: parsed.data.salaryPerShift || null } : {}),
        ...(parsed.data.salaryPerHour !== undefined ? { salaryPerHour: parsed.data.salaryPerHour || null } : {}),
        ...(parsed.data.commissionRate !== undefined ? { commissionRate: parsed.data.commissionRate || null } : {}),
        ...(parsed.data.allowCancelBill !== undefined ? { allowCancelBill: parsed.data.allowCancelBill } : {}),
        ...(parsed.data.allowDiscount !== undefined ? { allowDiscount: parsed.data.allowDiscount } : {}),
        ...(parsed.data.allowEditPrice !== undefined ? { allowEditPrice: parsed.data.allowEditPrice } : {}),
        ...(parsed.data.allowPayments !== undefined ? { allowPayments: parsed.data.allowPayments } : {}),
        ...(parsed.data.branchId !== undefined ? { branchId: parsed.data.branchId || null } : {}),
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) } : {}),
      },
      select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, employeeCode: true, position: true, salaryPerShift: true, salaryPerHour: true, commissionRate: true, allowCancelBill: true, allowDiscount: true, allowEditPrice: true, allowPayments: true, role: true, status: true, branchId: true, createdAt: true },
    });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


app.delete('/users/:id', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (req.params.id === req.user!.sub) return res.status(400).json({ message: 'Không thể xóa chính tài khoản đang đăng nhập' });
    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    if (user.role === UserRole.OWNER) return res.status(403).json({ message: 'Không được xóa tài khoản Chủ quán khác' });
    await prisma.user.delete({ where: { id: user.id } });
    await writeAudit(req, 'DELETE_USER', 'HR', { deletedUserId: user.id, email: user.email, fullName: user.fullName, role: user.role });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/super-admin/tenants', requireAuth, requireRoles(UserRole.SUPER_ADMIN), async (_req, res) => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { branches: true, users: true, orders: true } } },
  });
  res.json(tenants);
});

app.post('/branches', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ name: z.string().min(2), phone: z.string().optional(), address: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu chi nhánh không hợp lệ' });
    const branch = await prisma.branch.create({ data: { tenantId, ...parsed.data } });
    res.status(201).json(branch);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/branches', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branches = await prisma.branch.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    res.json(branches);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/areas', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const areas = await prisma.area.findMany({
      where: { tenantId, branchId },
      include: { tables: { orderBy: { name: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(areas);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/areas', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ branchId: z.string(), name: z.string().min(2), sortOrder: z.number().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu khu vực không hợp lệ' });
    const area = await prisma.area.create({ data: { tenantId, ...parsed.data } });
    res.status(201).json(area);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/tables', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ branchId: z.string(), areaId: z.string(), name: z.string().min(1), capacity: z.number().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu bàn không hợp lệ' });
    const table = await prisma.diningTable.create({ data: { tenantId, ...parsed.data } });
    emitToBranch(parsed.data.branchId, 'table.status_changed', table);
    res.status(201).json(table);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


app.patch('/tables/:id', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({
      areaId: z.string().optional(),
      name: z.string().min(1).optional(),
      capacity: z.number().int().positive().optional(),
      status: z.nativeEnum(TableStatus).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu cập nhật bàn không hợp lệ' });
    const table = await prisma.diningTable.findFirst({ where: { id: req.params.id, tenantId } });
    if (!table) return res.status(404).json({ message: 'Không tìm thấy bàn' });
    const updated = await prisma.diningTable.update({ where: { id: table.id }, data: parsed.data });
    emitToBranch(updated.branchId, 'table.status_changed', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/tables/:id', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const table = await prisma.diningTable.findFirst({ where: { id: req.params.id, tenantId } });
    if (!table) return res.status(404).json({ message: 'Không tìm thấy bàn' });
    await prisma.diningTable.delete({ where: { id: table.id } });
    emitToBranch(table.branchId, 'table.deleted', table);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/categories', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const categories = await prisma.category.findMany({ where: { tenantId }, orderBy: { sortOrder: 'asc' } });
    res.json(categories);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/categories', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ name: z.string().min(2), imageUrl: z.string().optional(), sortOrder: z.number().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu danh mục không hợp lệ' });
    const category = await prisma.category.create({ data: { tenantId, ...parsed.data } });
    res.status(201).json(category);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/products', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      include: { category: true, variants: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/products', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({
      categoryId: z.string().optional(),
      name: z.string().min(2),
      sku: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      price: z.number().nonnegative(),
      costPrice: z.number().nonnegative().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu sản phẩm không hợp lệ' });
    const product = await prisma.product.create({ data: { tenantId, ...parsed.data } });
    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/products/:id', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({
      categoryId: z.string().optional().nullable(),
      name: z.string().min(2).optional(),
      sku: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      imageUrl: z.string().optional().nullable(),
      price: z.number().nonnegative().optional(),
      costPrice: z.number().nonnegative().optional().nullable(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu cập nhật sản phẩm không hợp lệ' });

    const product = await prisma.product.findFirst({ where: { id: req.params.id, tenantId } });
    if (!product) return res.status(404).json({ message: 'Không tìm thấy món' });

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId || null } : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.sku !== undefined ? { sku: parsed.data.sku || null } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
        ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl || null } : {}),
        ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
        ...(parsed.data.costPrice !== undefined ? { costPrice: parsed.data.costPrice } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      include: { category: true, variants: true },
    });
    await writeAudit(req, parsed.data.price !== undefined && Number(product.price) !== parsed.data.price ? 'EDIT_PRODUCT_PRICE' : 'UPDATE_PRODUCT', 'PRODUCT', { productId: product.id, productName: product.name, oldPrice: product.price, newPrice: parsed.data.price ?? product.price });
    emitToBranch(req.user!.branchId || '', 'product.updated', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/products/:id', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const product = await prisma.product.findFirst({ where: { id: req.params.id, tenantId } });
    if (!product) return res.status(404).json({ message: 'Không tìm thấy món' });
    const updated = await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    await writeAudit(req, 'DELETE_PRODUCT', 'PRODUCT', { productId: product.id, productName: product.name });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


function createReceiptNo(orderCode: string) {
  return `HD${orderCode.replace(/\D/g, '').slice(-7).padStart(7, '0')}`;
}

function buildDynamicPaymentQrUrl(input: {
  bankCode?: string | null;
  accountNo?: string | null;
  accountName?: string | null;
  template?: string | null;
  amount: number;
  receiptNo: string;
}) {
  const bankCode = (input.bankCode || '').trim();
  const accountNo = (input.accountNo || '').replace(/\s+/g, '').trim();
  if (!bankCode || !accountNo || !Number.isFinite(input.amount) || input.amount <= 0) return null;

  const template = (input.template || 'compact2').trim() || 'compact2';
  const amount = Math.max(0, Math.round(input.amount));
  const addInfo = `Thanh toan ${input.receiptNo}`;
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo,
  });

  if (input.accountName?.trim()) {
    params.set('accountName', input.accountName.trim());
  }

  return `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNo)}-${encodeURIComponent(template)}.png?${params.toString()}`;
}

async function buildInvoicePayload(orderId: string, tenantId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      tenant: true,
      branch: true,
      table: true,
      cashier: { select: { id: true, fullName: true, email: true } },
      items: { orderBy: { createdAt: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!order) return null;
  const receiptNo = order.receiptNo || createReceiptNo(order.code);
  const dynamicPaymentQrUrl = buildDynamicPaymentQrUrl({
    bankCode: order.tenant.paymentQrBankCode,
    accountNo: order.tenant.paymentQrAccountNo,
    accountName: order.tenant.paymentQrAccountName,
    template: order.tenant.paymentQrTemplate,
    amount: Number(order.total || order.subtotal || 0),
    receiptNo,
  });

  return {
    id: order.id,
    code: order.code,
    receiptNo,
    serviceType: order.serviceType,
    status: order.status,
    paymentStatus: order.paymentStatus,
    tableName: order.table?.name || (order.serviceType === 'TAKE_AWAY' ? 'Mang về' : 'Không bàn'),
    paymentQrDynamicUrl: dynamicPaymentQrUrl,
    paymentQrAmount: Number(order.total || order.subtotal || 0),
    paymentQrContent: `Thanh toan ${receiptNo}`,
    startedAt: order.createdAt,
    paidAt: order.paidAt || order.payments[0]?.createdAt || null,
    printedAt: new Date().toISOString(),
    printCount: order.printCount,
    tenant: {
      name: order.tenant.name,
      appName: order.tenant.appName,
      phone: order.tenant.phone,
      address: order.tenant.address,
      paymentQrUrl: order.tenant.paymentQrUrl,
      paymentQrNote: order.tenant.paymentQrNote,
      paymentQrBankCode: order.tenant.paymentQrBankCode,
      paymentQrAccountNo: order.tenant.paymentQrAccountNo,
      paymentQrAccountName: order.tenant.paymentQrAccountName,
      paymentQrTemplate: order.tenant.paymentQrTemplate,
      dynamicPaymentQrUrl,
      receiptHeaderLine: order.tenant.receiptHeaderLine,
      receiptShopName: order.tenant.receiptShopName,
      receiptShopAddress: order.tenant.receiptShopAddress,
      receiptShopPhone: order.tenant.receiptShopPhone,
      receiptFooterNote: order.tenant.receiptFooterNote,
    },
    branch: {
      name: order.branch.name,
      phone: order.branch.phone,
      address: order.branch.address,
    },
    cashier: order.cashier,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price || 0),
      total: Number(item.total || 0),
      note: item.note,
    })),
    subtotal: Number(order.subtotal || 0),
    discount: Number(order.discount || 0),
    tax: Number(order.tax || 0),
    total: Number(order.total || 0),
    payments: order.payments.map((payment) => ({ id: payment.id, method: payment.method, amount: Number(payment.amount || 0), reference: payment.reference, createdAt: payment.createdAt })),
    note: order.note,
  };
}

app.get('/pos/bootstrap', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const [areas, products, categories] = await Promise.all([
      prisma.area.findMany({ where: { tenantId, branchId }, include: { tables: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.product.findMany({ where: { tenantId, isActive: true }, include: { category: true, variants: true } }),
      prisma.category.findMany({ where: { tenantId, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    ]);
    res.json({ areas, products, categories });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


app.get('/pos/tables/:tableId/current-order', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const order = await prisma.order.findFirst({
      where: {
        tenantId,
        branchId,
        tableId: req.params.tableId,
        paymentStatus: { not: PaymentStatus.PAID },
        status: { notIn: [OrderStatus.PAID, OrderStatus.CANCELLED] },
      },
      include: { items: true, table: true, payments: true, cashier: { select: { fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(order || null);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});



app.get('/invoices', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = typeof req.query.branchId === 'string' && req.query.branchId ? req.query.branchId : getBranchId(req);
    const status = typeof req.query.status === 'string' ? req.query.status : 'ALL';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const start = parseDateInput(req.query.from, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const end = parseDateInput(req.query.to, new Date(Date.now() + 24 * 60 * 60 * 1000));
    const where: any = {
      tenantId,
      branchId,
      createdAt: { gte: start, lte: end },
      ...(status !== 'ALL' ? { status: status as OrderStatus } : {}),
      ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { receiptNo: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    const invoices = await prisma.order.findMany({
      where,
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        table: true,
        payments: { orderBy: { createdAt: 'desc' } },
        cashier: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(invoices.map((order) => ({
      ...order,
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      tax: Number(order.tax || 0),
      total: Number(order.total || 0),
      items: order.items.map((item) => ({ ...item, price: Number(item.price || 0), total: Number(item.total || 0) })),
      payments: order.payments.map((payment) => ({ ...payment, amount: Number(payment.amount || 0) })),
    })));
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

async function recalculateOrderAfterInvoiceEdit(orderId: string, tx: any) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { payments: { orderBy: { createdAt: 'desc' } } } });
  if (!order) throw new Error('Không tìm thấy hóa đơn');
  const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);
  const total = Math.max(subtotal - Number(order.discount || 0) + Number(order.tax || 0), 0);
  const updated = await tx.order.update({
    where: { id: orderId },
    data: { subtotal, total },
    include: { items: true, table: true, payments: true, cashier: { select: { id: true, fullName: true, email: true } } },
  });
  // Nếu hóa đơn cũ đã thanh toán, đồng bộ lại số tiền payment gần nhất để báo cáo doanh thu khớp hóa đơn đã sửa.
  if (updated.paymentStatus === PaymentStatus.PAID && order.payments[0]) {
    await tx.payment.update({ where: { id: order.payments[0].id }, data: { amount: total } });
  }
  return updated;
}

app.patch('/invoices/:orderId', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({
      discount: z.number().nonnegative().optional(),
      tax: z.number().nonnegative().optional(),
      note: z.string().optional().nullable(),
      serviceType: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu cập nhật hóa đơn không hợp lệ' });
    const order = await prisma.order.findFirst({ where: { id: req.params.orderId, tenantId } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          ...(parsed.data.discount !== undefined ? { discount: parsed.data.discount } : {}),
          ...(parsed.data.tax !== undefined ? { tax: parsed.data.tax } : {}),
          ...(parsed.data.note !== undefined ? { note: parsed.data.note || null } : {}),
          ...(parsed.data.serviceType !== undefined ? { serviceType: parsed.data.serviceType } : {}),
        },
      });
      return recalculateOrderAfterInvoiceEdit(order.id, tx);
    });
    await writeAudit(req, 'OWNER_EDIT_OLD_INVOICE', 'INVOICE', { orderId: order.id, code: order.code, before: { discount: order.discount, tax: order.tax, note: order.note }, after: parsed.data });
    emitToBranch(order.branchId, 'invoice.updated', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/invoices/:orderId/items/:itemId', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({
      name: z.string().min(1).optional(),
      quantity: z.number().int().positive().optional(),
      price: z.number().nonnegative().optional(),
      note: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu món trong hóa đơn không hợp lệ' });
    const order = await prisma.order.findFirst({ where: { id: req.params.orderId, tenantId }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
    const item = order.items.find((entry) => entry.id === req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy món trong hóa đơn' });
    const updated = await prisma.$transaction(async (tx) => {
      const nextQuantity = parsed.data.quantity ?? item.quantity;
      const nextPrice = parsed.data.price ?? Number(item.price || 0);
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          quantity: nextQuantity,
          price: nextPrice,
          total: nextPrice * nextQuantity,
          ...(parsed.data.note !== undefined ? { note: parsed.data.note || null } : {}),
        },
      });
      return recalculateOrderAfterInvoiceEdit(order.id, tx);
    });
    await writeAudit(req, 'OWNER_EDIT_OLD_INVOICE_ITEM', 'INVOICE', { orderId: order.id, code: order.code, itemId: item.id, itemName: item.name, before: { quantity: item.quantity, price: item.price, note: item.note }, after: parsed.data });
    emitToBranch(order.branchId, 'invoice.updated', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/invoices/:orderId/items/:itemId', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const order = await prisma.order.findFirst({ where: { id: req.params.orderId, tenantId }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
    const item = order.items.find((entry) => entry.id === req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy món trong hóa đơn' });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: item.id } });
      return recalculateOrderAfterInvoiceEdit(order.id, tx);
    });
    await writeAudit(req, 'OWNER_DELETE_OLD_INVOICE_ITEM', 'INVOICE', { orderId: order.id, code: order.code, itemId: item.id, itemName: item.name });
    emitToBranch(order.branchId, 'invoice.updated', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/invoices/:orderId', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const invoice = await buildInvoicePayload(req.params.orderId, tenantId);
    if (!invoice) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
    res.json(invoice);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/invoices/:orderId/print', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const order = await prisma.order.findFirst({ where: { id: req.params.orderId, tenantId } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
    const receiptNo = order.receiptNo || createReceiptNo(order.code);
    await prisma.order.update({ where: { id: order.id }, data: { receiptNo, printCount: { increment: 1 } } });
    await writeAudit(req, 'PRINT_THERMAL_RECEIPT', 'POS', { orderId: order.id, code: order.code, receiptNo });
    const invoice = await buildInvoicePayload(order.id, tenantId);
    res.json(invoice);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/pos/tables/:tableId/checkout', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const order = await prisma.order.findFirst({
      where: {
        tenantId,
        branchId,
        tableId: req.params.tableId,
        paymentStatus: { not: PaymentStatus.PAID },
        status: { notIn: [OrderStatus.PAID, OrderStatus.CANCELLED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) return res.status(404).json({ message: 'Bàn này chưa có order đang mở' });
    req.params.id = order.id;
    // Gọi lại logic thanh toán theo order ở endpoint /pos/orders/:id/payment bằng cách trả về hướng dẫn cho frontend.
    res.json({ orderId: order.id, code: order.code, total: Number(order.total || 0), message: 'Dùng /pos/orders/:id/payment để thanh toán và lấy invoice' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/pos/orders', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      branchId: z.string(),
      tableId: z.string().optional().nullable(),
      note: z.string().optional(),
      items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive(), note: z.string().optional() })).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Order không hợp lệ' });
    const created = await createOrderFromPayload(req, parsed.data);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/pos/offline-sync', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const schema = z.object({
      orders: z.array(z.object({
        localId: z.string().min(3),
        branchId: z.string().optional(),
        tableId: z.string().optional().nullable(),
        note: z.string().optional(),
        items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive(), note: z.string().optional() })).min(1),
      })).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu đồng bộ offline không hợp lệ' });

    const results = [] as any[];
    for (const offlineOrder of parsed.data.orders) {
      const existed = await prisma.offlineSyncLog.findUnique({ where: { tenantId_localId: { tenantId, localId: offlineOrder.localId } } });
      if (existed) {
        results.push({ localId: offlineOrder.localId, status: 'SKIPPED', orderId: existed.orderId, message: 'Đã đồng bộ trước đó' });
        continue;
      }
      try {
        const created = await createOrderFromPayload(req, { ...offlineOrder, branchId: offlineOrder.branchId || branchId });
        await prisma.offlineSyncLog.create({ data: { tenantId, branchId: offlineOrder.branchId || branchId, userId: req.user!.sub, localId: offlineOrder.localId, status: 'SYNCED', orderId: created.order.id, payload: offlineOrder as any } });
        results.push({ localId: offlineOrder.localId, status: 'SYNCED', orderId: created.order.id, code: created.order.code });
      } catch (error: any) {
        await prisma.offlineSyncLog.create({ data: { tenantId, branchId: offlineOrder.branchId || branchId, userId: req.user!.sub, localId: offlineOrder.localId, status: 'FAILED', message: error.message, payload: offlineOrder as any } }).catch(() => undefined);
        results.push({ localId: offlineOrder.localId, status: 'FAILED', message: error.message });
      }
    }
    await writeAudit(req, 'OFFLINE_SYNC', 'POS', { total: parsed.data.orders.length, results });
    res.json({ results });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/orders', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const orders = await prisma.order.findMany({
      where: { tenantId, branchId },
      include: { items: true, table: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    res.json(orders);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/pos/orders/:orderId/items/:itemId', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ note: z.string().optional().nullable(), quantity: z.number().int().positive().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu món trong order không hợp lệ' });
    const order = await prisma.order.findFirst({ where: { id: req.params.orderId, tenantId }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy order' });
    const item = order.items.find((i) => i.id === req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy món trong order' });

    const updatedItem = await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        ...(parsed.data.note !== undefined ? { note: parsed.data.note || null } : {}),
        ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity, total: Number(item.price) * parsed.data.quantity } : {}),
      },
    });
    emitToBranch(order.branchId, 'order.item_updated', updatedItem);
    res.json(updatedItem);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/pos/orders/:id/payment', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH), amount: z.number().positive().optional(), reference: z.string().optional(), discount: z.number().nonnegative().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Thanh toán không hợp lệ' });

    if (!(await canDo(req, 'payments'))) return res.status(403).json({ message: 'Tài khoản không có quyền thanh toán' });
    if (parsed.data.discount && !(await canDo(req, 'discount'))) return res.status(403).json({ message: 'Tài khoản không có quyền giảm giá' });

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: req.params.id, tenantId } });
      if (!order) throw new Error('Không tìm thấy order');
      const discount = parsed.data.discount || Number(order.discount || 0);
      const finalTotal = Math.max(Number(order.total) - discount, 0);
      const paymentAmount = parsed.data.amount || finalTotal;
      const payment = await tx.payment.create({ data: { orderId: order.id, method: parsed.data.method, amount: paymentAmount, reference: parsed.data.reference, status: PaymentStatus.PAID } });
      const receiptNo = order.receiptNo || createReceiptNo(order.code);
      const paidOrder = await tx.order.update({
        where: { id: order.id },
        data: { total: finalTotal, discount, receiptNo, paidAt: new Date(), status: OrderStatus.PAID, paymentStatus: PaymentStatus.PAID },
        include: { items: true, table: true, payments: true },
      });
      if (order.tableId) await tx.diningTable.update({ where: { id: order.tableId }, data: { status: TableStatus.AVAILABLE } });
      return { order: paidOrder, payment };
    });

    const sellerId = result.order.cashierId || req.user!.sub;
    const [seller, tenantSetting] = await Promise.all([
      prisma.user.findUnique({ where: { id: sellerId }, select: { commissionRate: true, fullName: true } }),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { commissionMinSales: true } }),
    ]);
    const rate = Number(seller?.commissionRate || 0);
    const minSales = Number(tenantSetting?.commissionMinSales || 0);
    const baseAmount = Number(result.payment.amount || 0);
    if (sellerId && rate > 0 && baseAmount >= minSales) {
      await prisma.commissionRecord.create({
        data: {
          tenantId,
          branchId: result.order.branchId,
          userId: sellerId,
          orderId: result.order.id,
          paymentId: result.payment.id,
          type: CommissionType.PERCENT_OF_SALES,
          baseAmount: result.payment.amount,
          rate,
          amount: baseAmount * rate / 100,
          note: `Hoa hồng cho người gọi món ${seller?.fullName || ''} từ hóa đơn ${result.order.code}. Ngưỡng: ${minSales.toLocaleString('vi-VN')}đ`,
        },
      }).catch(() => undefined);
    }

    await writeAudit(req, 'PAY_ORDER', 'POS', { orderId: result.order.id, code: result.order.code, method: parsed.data.method, amount: result.payment.amount, discount: parsed.data.discount || 0 });
    emitToBranch(result.order.branchId, 'order.paid', result.order);
    if (result.order.tableId) emitToBranch(result.order.branchId, 'table.status_changed', { id: result.order.tableId, status: TableStatus.AVAILABLE });
    const invoice = await buildInvoicePayload(result.order.id, tenantId);
    res.json({ ...result, invoice });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


app.post('/pos/orders/:id/cancel', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!(await canDo(req, 'cancelBill'))) return res.status(403).json({ message: 'Tài khoản không có quyền hủy bill' });
    const schema = z.object({ reason: z.string().min(2).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Lý do hủy không hợp lệ' });
    const order = await prisma.order.findFirst({ where: { id: req.params.id, tenantId }, include: { table: true, items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy bill' });
    if (order.status === OrderStatus.PAID) return res.status(400).json({ message: 'Bill đã thanh toán, không thể hủy trực tiếp' });
    const cancelled = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED }, include: { table: true, items: true } });
      if (order.tableId) await tx.diningTable.update({ where: { id: order.tableId }, data: { status: TableStatus.AVAILABLE } });
      return updated;
    });
    await writeAudit(req, 'CANCEL_BILL', 'POS', { orderId: order.id, code: order.code, reason: parsed.data.reason || null, total: order.total });
    emitToBranch(order.branchId, 'order.cancelled', cancelled);
    if (order.tableId) emitToBranch(order.branchId, 'table.status_changed', { id: order.tableId, status: TableStatus.AVAILABLE });
    res.json(cancelled);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/pos/orders/:id/discount', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!(await canDo(req, 'discount'))) return res.status(403).json({ message: 'Tài khoản không có quyền giảm món/bill' });
    const schema = z.object({ discount: z.number().nonnegative(), reason: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu giảm giá không hợp lệ' });
    const order = await prisma.order.findFirst({ where: { id: req.params.id, tenantId } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy order' });
    const updated = await prisma.order.update({ where: { id: order.id }, data: { discount: parsed.data.discount, total: Math.max(Number(order.subtotal) - parsed.data.discount, 0) }, include: { items: true, table: true } });
    await writeAudit(req, 'DISCOUNT_ORDER', 'POS', { orderId: order.id, code: order.code, oldDiscount: order.discount, newDiscount: parsed.data.discount, reason: parsed.data.reason || null });
    emitToBranch(order.branchId, 'order.updated', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/pos/orders/:orderId/items/:itemId/price', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!(await canDo(req, 'editPrice'))) return res.status(403).json({ message: 'Tài khoản không có quyền sửa giá món trong bill' });
    const schema = z.object({ price: z.number().nonnegative(), reason: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Giá mới không hợp lệ' });
    const order = await prisma.order.findFirst({ where: { id: req.params.orderId, tenantId }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy order' });
    const item = order.items.find((orderItem) => orderItem.id === req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy món trong bill' });
    const updatedItem = await prisma.orderItem.update({ where: { id: item.id }, data: { price: parsed.data.price, total: parsed.data.price * item.quantity } });
    const allItems = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    const subtotal = allItems.reduce((sum, orderItem) => sum + Number(orderItem.total), 0);
    const updated = await prisma.order.update({ where: { id: order.id }, data: { subtotal, total: Math.max(subtotal - Number(order.discount), 0) }, include: { items: true, table: true } });
    await writeAudit(req, 'EDIT_ITEM_PRICE', 'POS', { orderId: order.id, code: order.code, itemId: item.id, itemName: item.name, oldPrice: item.price, newPrice: parsed.data.price, reason: parsed.data.reason || null });
    emitToBranch(order.branchId, 'order.updated', updated);
    res.json({ order: updated, item: updatedItem });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/pos/orders/:id/change-table', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ tableId: z.string().nullable(), reason: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu chuyển bàn không hợp lệ' });
    const order = await prisma.order.findFirst({ where: { id: req.params.id, tenantId } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy order' });
    const updated = await prisma.$transaction(async (tx) => {
      if (order.tableId) await tx.diningTable.update({ where: { id: order.tableId }, data: { status: TableStatus.AVAILABLE } });
      if (parsed.data.tableId) await tx.diningTable.update({ where: { id: parsed.data.tableId }, data: { status: TableStatus.OCCUPIED } });
      return tx.order.update({ where: { id: order.id }, data: { tableId: parsed.data.tableId || null }, include: { items: true, table: true } });
    });
    await writeAudit(req, 'CHANGE_TABLE', 'POS', { orderId: order.id, code: order.code, fromTableId: order.tableId, toTableId: parsed.data.tableId, reason: parsed.data.reason || null });
    emitToBranch(order.branchId, 'order.updated', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/pos/orders/:id/print', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const order = await prisma.order.findFirst({ where: { id: req.params.id, tenantId } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy order' });
    const receiptNo = order.receiptNo || createReceiptNo(order.code);
    await prisma.order.update({ where: { id: order.id }, data: { receiptNo, printCount: { increment: 1 } } });
    await writeAudit(req, 'PRINT_INVOICE', 'POS', { orderId: order.id, code: order.code, receiptNo });
    const invoice = await buildInvoicePayload(order.id, tenantId);
    res.json({ invoice, printedAt: new Date().toISOString() });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/pos/orders/:id/split-bill', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ itemIds: z.array(z.string()).min(1), note: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu tách bill không hợp lệ' });
    const order = await prisma.order.findFirst({ where: { id: req.params.id, tenantId }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy order' });
    const splitItems = order.items.filter((item) => parsed.data.itemIds.includes(item.id));
    if (splitItems.length === 0) return res.status(400).json({ message: 'Không có món để tách' });
    const result = await prisma.$transaction(async (tx) => {
      const subtotal = splitItems.reduce((sum, item) => sum + Number(item.total), 0);
      const newOrder = await tx.order.create({
        data: {
          tenantId,
          branchId: order.branchId,
          tableId: order.tableId,
          cashierId: req.user!.sub,
          code: `SP${Date.now().toString().slice(-8)}`,
          status: OrderStatus.PENDING,
          subtotal,
          total: subtotal,
          note: parsed.data.note || `Tách từ bill ${order.code}`,
          items: { create: splitItems.map((item) => ({ productId: item.productId, name: item.name, quantity: item.quantity, price: item.price, total: item.total, note: item.note })) },
        },
        include: { items: true, table: true },
      });
      await tx.orderItem.deleteMany({ where: { id: { in: splitItems.map((item) => item.id) } } });
      const remainingItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const remainingSubtotal = remainingItems.reduce((sum, item) => sum + Number(item.total), 0);
      const source = await tx.order.update({ where: { id: order.id }, data: { subtotal: remainingSubtotal, total: Math.max(remainingSubtotal - Number(order.discount), 0) }, include: { items: true, table: true } });
      return { source, newOrder };
    });
    await writeAudit(req, 'SPLIT_BILL', 'POS', { sourceOrderId: order.id, newOrderId: result.newOrder.id, itemIds: parsed.data.itemIds });
    emitToBranch(order.branchId, 'order.updated', result);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/pos/orders/:id/merge-bill', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ targetOrderId: z.string(), reason: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu gộp bill không hợp lệ' });
    const source = await prisma.order.findFirst({ where: { id: req.params.id, tenantId }, include: { items: true } });
    const target = await prisma.order.findFirst({ where: { id: parsed.data.targetOrderId, tenantId }, include: { items: true } });
    if (!source || !target) return res.status(404).json({ message: 'Không tìm thấy bill nguồn hoặc bill đích' });
    const result = await prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({ where: { orderId: source.id }, data: { orderId: target.id } });
      const items = await tx.orderItem.findMany({ where: { orderId: target.id } });
      const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);
      const merged = await tx.order.update({ where: { id: target.id }, data: { subtotal, total: Math.max(subtotal - Number(target.discount), 0) }, include: { items: true, table: true } });
      await tx.order.update({ where: { id: source.id }, data: { status: OrderStatus.CANCELLED } });
      if (source.tableId && source.tableId !== target.tableId) await tx.diningTable.update({ where: { id: source.tableId }, data: { status: TableStatus.AVAILABLE } });
      return merged;
    });
    await writeAudit(req, 'MERGE_BILL', 'POS', { sourceOrderId: source.id, targetOrderId: target.id, reason: parsed.data.reason || null });
    emitToBranch(target.branchId, 'order.updated', result);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/kitchen/tickets', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const tickets = await prisma.kitchenTicket.findMany({
      where: { tenantId, branchId },
      include: { items: true, order: { include: { table: true } } },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    res.json(tickets);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/kitchen/items/:id/status', requireAuth, async (req, res) => {
  const schema = z.object({ status: z.enum(['WAITING', 'COOKING', 'DONE', 'CANCELLED']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Trạng thái không hợp lệ' });

  const item = await prisma.kitchenTicketItem.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
    include: { kitchenTicket: { include: { items: true, order: { include: { items: true, table: true } } } } },
  });

  emitToKitchen(item.kitchenTicket.branchId, 'kitchen.item_status_changed', item);
  emitToBranch(item.kitchenTicket.branchId, 'kitchen.item_status_changed', item);

  const allDone = item.kitchenTicket.items.every((ticketItem) => ticketItem.status === 'DONE');
  if (parsed.data.status === 'DONE' && allDone) {
    const readyOrder = await prisma.order.update({
      where: { id: item.kitchenTicket.orderId },
      data: { status: OrderStatus.READY },
      include: { items: true, table: true, cashier: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    emitToBranch(item.kitchenTicket.branchId, 'order.ready', {
      order: readyOrder,
      message: `Bếp đã hoàn thành order ${readyOrder.code}`,
      bell: true,
    });
  }

  res.json(item);
});


app.get('/hr/roles', requireAuth, async (_req, res) => {
  res.json([
    { role: 'OWNER', label: 'Chủ quán', permissions: ['Toàn quyền', 'Cấp quyền', 'Hủy bill', 'Sửa giá', 'Xem báo cáo'] },
    { role: 'MANAGER', label: 'Quản lý', permissions: ['Quản lý nhân viên', 'Chấm công', 'Ca làm', 'Duyệt giảm giá', 'Xem nhật ký'] },
    { role: 'CASHIER', label: 'Thu ngân', permissions: ['Thanh toán', 'In hóa đơn', 'Tách/gộp bill', 'Kết ca'] },
    { role: 'WAITER', label: 'Phục vụ', permissions: ['Order tại bàn', 'Chuyển món xuống bếp/bar', 'Chuyển bàn khi được cấp quyền'] },
    { role: 'KITCHEN', label: 'Bếp', permissions: ['Nhận món', 'Bấm đang làm / hoàn thành', 'Báo chuông về POS'] },
    { role: 'BAR', label: 'Bar', permissions: ['Nhận món nước', 'Báo hoàn thành'] },
  ]);
});

app.get('/hr/work-shifts', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const shifts = await prisma.workShift.findMany({ where: { tenantId, branchId, isActive: true }, orderBy: { startTime: 'asc' } });
    res.json(shifts);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/hr/work-shifts', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ branchId: z.string(), name: z.string().min(2), startTime: z.string(), endTime: z.string(), color: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Ca làm không hợp lệ' });
    const shift = await prisma.workShift.create({ data: { tenantId, ...parsed.data } });
    await writeAudit(req, 'CREATE_WORK_SHIFT', 'HR', shift);
    res.status(201).json(shift);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/hr/attendance', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const records = await prisma.attendanceRecord.findMany({ where: { tenantId, branchId }, orderBy: { checkInAt: 'desc' }, take: 120 });
    const userIds = [...new Set(records.map((record) => record.userId))];
    const shiftIds = [...new Set(records.map((record) => record.workShiftId).filter(Boolean))] as string[];
    const [users, shifts] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, avatarUrl: true, role: true, employeeCode: true } }),
      prisma.workShift.findMany({ where: { id: { in: shiftIds } } }),
    ]);
    const userMap = new Map(users.map((user) => [user.id, user]));
    const shiftMap = new Map(shifts.map((shift) => [shift.id, shift]));
    res.json(records.map((record) => ({ ...record, user: userMap.get(record.userId), workShift: record.workShiftId ? shiftMap.get(record.workShiftId) : null })));
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/hr/attendance/check-in', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const schema = z.object({ userId: z.string().optional(), workShiftId: z.string().optional(), note: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu chấm công không hợp lệ' });
    const userId = parsed.data.userId && hasRole(req.user!.role, [UserRole.OWNER, UserRole.MANAGER]) ? parsed.data.userId : req.user!.sub;
    const open = await prisma.attendanceRecord.findFirst({ where: { tenantId, branchId, userId, status: AttendanceStatus.CHECKED_IN } });
    if (open) return res.json(open);
    const record = await prisma.attendanceRecord.create({ data: { tenantId, branchId, userId, workShiftId: parsed.data.workShiftId, checkInNote: parsed.data.note, createdById: req.user!.sub } });
    await writeAudit(req, 'CHECK_IN', 'HR', { userId, workShiftId: parsed.data.workShiftId || null });
    emitToBranch(branchId, 'attendance.check_in', record);
    res.status(201).json(record);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/hr/attendance/:id/check-out', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const schema = z.object({ note: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu chấm ra không hợp lệ' });
    const record = await prisma.attendanceRecord.findFirst({ where: { id: req.params.id, tenantId, branchId } });
    if (!record) return res.status(404).json({ message: 'Không tìm thấy lượt chấm công' });
    if (record.userId !== req.user!.sub && !hasRole(req.user!.role, [UserRole.OWNER, UserRole.MANAGER])) return res.status(403).json({ message: 'Không được chấm ra cho người khác' });
    const updated = await prisma.attendanceRecord.update({ where: { id: record.id }, data: { checkOutAt: new Date(), checkOutNote: parsed.data.note, status: AttendanceStatus.CHECKED_OUT } });
    await writeAudit(req, 'CHECK_OUT', 'HR', { userId: record.userId, attendanceId: record.id });
    emitToBranch(branchId, 'attendance.check_out', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/hr/commission-rules', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const rules = await prisma.commissionRule.findMany({ where: { tenantId, OR: [{ branchId }, { branchId: null }] }, orderBy: { createdAt: 'desc' } });
    res.json(rules);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/hr/commission-rules', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ branchId: z.string().optional().nullable(), name: z.string().min(2), role: z.nativeEnum(UserRole).optional().nullable(), type: z.nativeEnum(CommissionType).default(CommissionType.PERCENT_OF_SALES), value: z.number().nonnegative() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Quy tắc hoa hồng không hợp lệ' });
    const rule = await prisma.commissionRule.create({ data: { tenantId, branchId: parsed.data.branchId || null, name: parsed.data.name, role: parsed.data.role || null, type: parsed.data.type, value: parsed.data.value } });
    await writeAudit(req, 'CREATE_COMMISSION_RULE', 'HR', rule);
    res.status(201).json(rule);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/hr/commissions', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const records = await prisma.commissionRecord.findMany({ where: { tenantId, branchId }, orderBy: { createdAt: 'desc' }, take: 120 });
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(records.map((record) => record.userId))] } }, select: { id: true, fullName: true, avatarUrl: true, role: true } });
    const userMap = new Map(users.map((user) => [user.id, user]));
    res.json(records.map((record) => ({ ...record, user: userMap.get(record.userId) })));
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


app.get('/hr/payroll', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { start, end, label } = monthRange(String(req.query.month || ''));
    const isManager = hasRole(req.user!.role, [UserRole.OWNER, UserRole.SUPER_ADMIN]);
    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const userWhere: any = { tenantId, branchId };
    if (!isManager) userWhere.id = req.user!.sub;
    if (isManager && requestedUserId) userWhere.id = requestedUserId;

    const users = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, fullName: true, email: true, avatarUrl: true, role: true, employeeCode: true, salaryPerHour: true, salaryPerShift: true, commissionRate: true },
      orderBy: { fullName: 'asc' },
    });
    const userIds = users.map((user) => user.id);
    const [attendance, commissions] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { tenantId, branchId, userId: { in: userIds }, checkInAt: { gte: start, lt: end } },
        orderBy: { checkInAt: 'asc' },
      }),
      prisma.commissionRecord.findMany({
        where: { tenantId, branchId, userId: { in: userIds }, createdAt: { gte: start, lt: end } },
      }),
    ]);

    const rows = users.map((user) => {
      const userAttendance = attendance.filter((record) => record.userId === user.id);
      const minutes = userAttendance.reduce((sum, record) => {
        const out = record.checkOutAt || new Date();
        const diff = Math.max(0, out.getTime() - record.checkInAt.getTime());
        return sum + Math.round(diff / 60000);
      }, 0);
      const hours = Math.round((minutes / 60) * 100) / 100;
      const salaryPerHour = Number(user.salaryPerHour || 0);
      const baseSalary = Math.round(hours * salaryPerHour);
      const commission = commissions
        .filter((record) => record.userId === user.id)
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);
      const shiftCount = userAttendance.filter((record) => record.checkOutAt).length;
      const salaryPerShift = Number(user.salaryPerShift || 0);
      const shiftSalary = shiftCount * salaryPerShift;
      return {
        user,
        month: label,
        attendanceCount: userAttendance.length,
        completedShiftCount: shiftCount,
        totalMinutes: minutes,
        totalHours: hours,
        salaryPerHour,
        salaryPerShift,
        hourlySalary: baseSalary,
        shiftSalary,
        commission,
        totalSalary: baseSalary + shiftSalary + commission,
      };
    });
    const totals = rows.reduce((acc, row) => ({
      totalHours: acc.totalHours + row.totalHours,
      hourlySalary: acc.hourlySalary + row.hourlySalary,
      commission: acc.commission + row.commission,
      shiftSalary: acc.shiftSalary + row.shiftSalary,
      totalSalary: acc.totalSalary + row.totalSalary,
    }), { totalHours: 0, hourlySalary: 0, shiftSalary: 0, commission: 0, totalSalary: 0 });
    res.json({ month: label, start, end, canViewAll: isManager, rows, totals });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


app.get('/hr/payroll/export', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { start, end, label } = monthRange(String(req.query.month || ''));
    const isManager = hasRole(req.user!.role, [UserRole.OWNER, UserRole.SUPER_ADMIN]);
    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const userWhere: any = { tenantId, branchId };
    if (!isManager) userWhere.id = req.user!.sub;
    if (isManager && requestedUserId) userWhere.id = requestedUserId;

    const [tenant, branch, users] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, address: true, phone: true } }),
      prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
      prisma.user.findMany({
        where: userWhere,
        select: { id: true, fullName: true, email: true, role: true, employeeCode: true, salaryPerHour: true, salaryPerShift: true, commissionRate: true },
        orderBy: { fullName: 'asc' },
      }),
    ]);
    const userIds = users.map((user) => user.id);
    const [attendance, commissions] = await Promise.all([
      prisma.attendanceRecord.findMany({ where: { tenantId, branchId, userId: { in: userIds }, checkInAt: { gte: start, lt: end } }, orderBy: { checkInAt: 'asc' } }),
      prisma.commissionRecord.findMany({ where: { tenantId, branchId, userId: { in: userIds }, createdAt: { gte: start, lt: end } } }),
    ]);
    const rows = users.map((user) => {
      const userAttendance = attendance.filter((record) => record.userId === user.id);
      const minutes = userAttendance.reduce((sum, record) => {
        const out = record.checkOutAt || new Date();
        const diff = Math.max(0, out.getTime() - record.checkInAt.getTime());
        return sum + Math.round(diff / 60000);
      }, 0);
      const hours = Math.round((minutes / 60) * 100) / 100;
      const salaryPerHour = Number(user.salaryPerHour || 0);
      const hourlySalary = Math.round(hours * salaryPerHour);
      const commission = commissions.filter((record) => record.userId === user.id).reduce((sum, record) => sum + Number(record.amount || 0), 0);
      const shiftCount = userAttendance.filter((record) => record.checkOutAt).length;
      const salaryPerShift = Number(user.salaryPerShift || 0);
      const shiftSalary = shiftCount * salaryPerShift;
      return { user, shiftCount, hours, salaryPerHour, hourlySalary, salaryPerShift, shiftSalary, commission, totalSalary: hourlySalary + shiftSalary + commission };
    });
    const totals = rows.reduce((acc, row) => ({
      hours: acc.hours + row.hours,
      hourlySalary: acc.hourlySalary + row.hourlySalary,
      shiftSalary: acc.shiftSalary + row.shiftSalary,
      commission: acc.commission + row.commission,
      totalSalary: acc.totalSalary + row.totalSalary,
    }), { hours: 0, hourlySalary: 0, shiftSalary: 0, commission: 0, totalSalary: 0 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Stype POS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Bảng lương');
    setupSheet(sheet, [26, 30, 16, 16, 16, 16, 16, 16, 16, 18, 18]);
    styleReportTitle(sheet, 'BẢNG LƯƠNG NHÂN VIÊN - STYPE POS', 'K1');
    addInfoRows(sheet, [
      ['Tên quán', tenant?.name || '', 'Chi nhánh', branch?.name || '', 'Tháng', label, 'Ngày xuất', vnDate(new Date())],
      ['Địa chỉ', tenant?.address || '', 'SĐT', tenant?.phone || '', 'Người xuất', req.user?.email || '', 'Quyền xem', isManager ? 'Toàn bộ' : 'Cá nhân'],
    ], 3);
    sheet.addRow([]);
    const summaryHeader = 6;
    sheet.getRow(summaryHeader).values = ['Tổng giờ', 'Tổng lương giờ', 'Tổng lương ca', 'Tổng hoa hồng', 'Tổng phải trả'];
    sheet.addRow([totals.hours, totals.hourlySalary, totals.shiftSalary, totals.commission, totals.totalSalary]);
    styleTable(sheet, summaryHeader, 1, 5, summaryHeader + 1);
    [2, 3, 4, 5].forEach((column) => { sheet.getRow(summaryHeader + 1).getCell(column).numFmt = '#,##0'; });
    sheet.addRow([]);
    const headerRow = 10;
    sheet.getRow(headerRow).values = ['Nhân viên', 'Email', 'Vai trò', 'Mã NV', 'Số ca', 'Số giờ', 'Lương/giờ', 'Lương giờ', 'Lương/ca', 'Lương ca', 'Hoa hồng', 'Tổng lương'];
    rows.forEach((row) => sheet.addRow([
      row.user.fullName,
      row.user.email,
      row.user.role,
      row.user.employeeCode || '',
      row.shiftCount,
      row.hours,
      row.salaryPerHour,
      row.hourlySalary,
      row.salaryPerShift,
      row.shiftSalary,
      row.commission,
      row.totalSalary,
    ]));
    setupSheet(sheet, [26, 30, 16, 16, 12, 12, 16, 16, 16, 16, 16, 18]);
    styleTable(sheet, headerRow, 1, 12, Math.max(headerRow, sheet.rowCount));
    [7, 8, 9, 10, 11, 12].forEach((column) => { sheet.getColumn(column).numFmt = '#,##0'; });
    await sendWorkbook(res, workbook, `stype-pos-bang-luong-${label}.xlsx`);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/hr/salary/:userId', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({ salaryPerHour: z.number().nonnegative().optional().nullable(), salaryPerShift: z.number().nonnegative().optional().nullable(), commissionRate: z.number().nonnegative().optional().nullable() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu lương không hợp lệ' });
    const user = await prisma.user.findFirst({ where: { id: req.params.userId, tenantId } });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(parsed.data.salaryPerHour !== undefined ? { salaryPerHour: parsed.data.salaryPerHour || null } : {}),
        ...(parsed.data.salaryPerShift !== undefined ? { salaryPerShift: parsed.data.salaryPerShift || null } : {}),
        ...(parsed.data.commissionRate !== undefined ? { commissionRate: parsed.data.commissionRate || null } : {}),
      },
      select: { id: true, fullName: true, salaryPerHour: true, salaryPerShift: true, commissionRate: true },
    });
    await writeAudit(req, 'UPDATE_SALARY', 'HR', { userId: user.id, before: { salaryPerHour: user.salaryPerHour, salaryPerShift: user.salaryPerShift, commissionRate: user.commissionRate }, after: updated });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/audit-logs', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const logs = await prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 200 });
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((log) => log.userId).filter(Boolean))] as string[] } }, select: { id: true, fullName: true, avatarUrl: true, role: true } });
    const userMap = new Map(users.map((user) => [user.id, user]));
    res.json(logs.map((log) => ({ ...log, user: log.userId ? userMap.get(log.userId) : null })));
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/payments', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const orders = await prisma.order.findMany({
      where: { tenantId, branchId },
      include: { payments: true, items: true, table: true, cashier: { select: { fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 120,
    });
    const paidOrders = orders.filter((order) => order.paymentStatus === PaymentStatus.PAID);
    const unpaidOrders = orders.filter((order) => order.paymentStatus !== PaymentStatus.PAID && order.status !== OrderStatus.CANCELLED);
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total), 0);
    res.json({
      revenue,
      paidCount: paidOrders.length,
      unpaidCount: unpaidOrders.length,
      unpaidOrders,
      recentPayments: paidOrders.slice(0, 40),
      methods: Object.values(PaymentMethod),
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


app.get('/shifts/current', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const shift = await prisma.shiftSession.findFirst({
      where: { tenantId, branchId, userId: req.user!.sub, status: ShiftStatus.OPEN },
      orderBy: { openedAt: 'desc' },
    });
    res.json(shift || null);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/shifts', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const shifts = await prisma.shiftSession.findMany({
      where: { tenantId, branchId },
      orderBy: { openedAt: 'desc' },
      take: 60,
    });
    res.json(shifts);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/shifts/open', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const schema = z.object({ openingCash: z.number().nonnegative().default(0), note: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu mở ca không hợp lệ' });
    const existing = await prisma.shiftSession.findFirst({ where: { tenantId, branchId, userId: req.user!.sub, status: ShiftStatus.OPEN } });
    if (existing) return res.json(existing);
    const shift = await prisma.shiftSession.create({
      data: {
        tenantId,
        branchId,
        userId: req.user!.sub,
        openingCash: parsed.data.openingCash,
        expectedCash: parsed.data.openingCash,
        note: parsed.data.note,
        status: ShiftStatus.OPEN,
      },
    });
    emitToBranch(branchId, 'shift.opened', shift);
    res.status(201).json(shift);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/shifts/:id/close', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const schema = z.object({ closingCash: z.number().nonnegative(), note: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu kết ca không hợp lệ' });

    const shift = await prisma.shiftSession.findFirst({ where: { id: req.params.id, tenantId, branchId, userId: req.user!.sub, status: ShiftStatus.OPEN } });
    if (!shift) return res.status(404).json({ message: 'Không tìm thấy ca đang mở' });

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: shift.openedAt },
        order: { tenantId, branchId, status: OrderStatus.PAID },
      },
    });
    const sumByMethod = (method: PaymentMethod) => payments.filter((payment) => payment.method === method).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const cashSales = sumByMethod(PaymentMethod.CASH);
    const bankSales = sumByMethod(PaymentMethod.BANK_TRANSFER);
    const qrSales = sumByMethod(PaymentMethod.QR);
    const cardSales = sumByMethod(PaymentMethod.CARD);
    const eWalletSales = sumByMethod(PaymentMethod.E_WALLET);
    const expectedCash = Number(shift.openingCash) + cashSales;
    const difference = parsed.data.closingCash - expectedCash;

    const closed = await prisma.shiftSession.update({
      where: { id: shift.id },
      data: {
        closedAt: new Date(),
        closingCash: parsed.data.closingCash,
        cashSales,
        bankSales,
        qrSales,
        cardSales,
        eWalletSales,
        expectedCash,
        difference,
        note: parsed.data.note || shift.note,
        status: ShiftStatus.CLOSED,
      },
    });
    emitToBranch(branchId, 'shift.closed', closed);
    res.json(closed);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});



app.get('/inventory/summary', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = String(req.query.branchId || req.user?.branchId || '');
    const ingredients = await prisma.ingredient.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    const movements = await prisma.stockMovement.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: { ingredient: true },
    });
    const stockMap = new Map<string, number>();
    for (const ingredient of ingredients) stockMap.set(ingredient.id, 0);
    for (const movement of movements) {
      const current = stockMap.get(movement.ingredientId) || 0;
      const qty = Number(movement.quantity || 0);
      const sign = ['IMPORT', 'ADJUST_IN', 'RETURN'].includes(movement.type) ? 1 : -1;
      stockMap.set(movement.ingredientId, current + qty * sign);
    }
    const rows = ingredients.map((ingredient) => {
      const stock = stockMap.get(ingredient.id) || 0;
      return {
        ...ingredient,
        stock,
        isLow: ingredient.minStock != null ? stock <= Number(ingredient.minStock) : false,
      };
    });
    res.json({ ingredients: rows, movements });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Không tải được tồn kho' });
  }
});

app.get('/inventory/ingredients', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const ingredients = await prisma.ingredient.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  res.json(ingredients);
});

app.post('/inventory/ingredients', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  const schema = z.object({ name: z.string().min(1), unit: z.string().min(1), minStock: z.number().optional().default(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu nguyên liệu không hợp lệ' });
  const ingredient = await prisma.ingredient.create({ data: { tenantId: getTenantId(req), ...parsed.data } });
  await writeAudit(req, 'CREATE_INGREDIENT', 'INVENTORY', ingredient);
  res.status(201).json(ingredient);
});

app.post('/inventory/movements', requireAuth, requireRoles(UserRole.OWNER), async (req, res) => {
  const schema = z.object({ branchId: z.string().optional(), ingredientId: z.string(), type: z.string().min(1), quantity: z.number().positive(), note: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu nhập/xuất kho không hợp lệ' });
  const movement = await prisma.stockMovement.create({
    data: { tenantId: getTenantId(req), branchId: parsed.data.branchId || req.user?.branchId || null, ingredientId: parsed.data.ingredientId, type: parsed.data.type, quantity: parsed.data.quantity, note: parsed.data.note },
  });
  await writeAudit(req, 'STOCK_MOVEMENT', 'INVENTORY', movement);
  res.status(201).json(movement);
});

app.get('/crm/customers', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const customers = await prisma.customer.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { orders: { select: { id: true, total: true, createdAt: true, paymentStatus: true }, take: 20, orderBy: { createdAt: 'desc' } } },
  });
  res.json(customers.map((customer) => ({
    ...customer,
    totalSpent: customer.orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    orderCount: customer.orders.length,
  })));
});

app.post('/crm/customers', requireAuth, async (req, res) => {
  const schema = z.object({ fullName: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional().or(z.literal('')), birthday: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu khách hàng không hợp lệ' });
  const customer = await prisma.customer.create({
    data: { tenantId: getTenantId(req), fullName: parsed.data.fullName, phone: parsed.data.phone, email: parsed.data.email || null, birthday: parsed.data.birthday ? new Date(parsed.data.birthday) : null },
  });
  await writeAudit(req, 'CREATE_CUSTOMER', 'CRM', customer);
  res.status(201).json(customer);
});

app.get('/ai/insights', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const branchId = String(req.query.branchId || req.user?.branchId || '');
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [topProducts, revenue, lowIngredients] = await Promise.all([
    prisma.orderItem.groupBy({ by: ['name'], where: { order: { tenantId, ...(branchId ? { branchId } : {}), createdAt: { gte: since } } }, _sum: { quantity: true, total: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
    prisma.payment.aggregate({ where: { order: { tenantId, ...(branchId ? { branchId } : {}), createdAt: { gte: since } }, status: PaymentStatus.PAID }, _sum: { amount: true } }),
    prisma.ingredient.findMany({ where: { tenantId }, take: 8, orderBy: { minStock: 'desc' } }),
  ]);
  const best = topProducts[0]?.name || 'chưa đủ dữ liệu';
  const revenue30 = Number(revenue._sum.amount || 0);
  res.json({
    revenue30,
    bestSeller: best,
    topProducts,
    lowIngredients,
    suggestions: [
      `Món nổi bật 30 ngày: ${best}. Nên đặt ở vị trí đầu menu/POS.`,
      revenue30 > 0 ? `Doanh thu 30 ngày đạt ${revenue30.toLocaleString('vi-VN')}đ. Nên so sánh theo khung giờ cao điểm.` : 'Chưa có doanh thu đủ lớn để dự báo. Hãy bán thử và ghi nhận dữ liệu 7 ngày.',
      'Bật cảnh báo tồn kho thấp cho cafe, sữa, ly, đá và topping bán chạy.',
    ],
  });
});


app.get('/reports/revenue', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { from, to } = reportDateRange(req.query.from, req.query.to);

    const [payments, orders, topProducts] = await Promise.all([
      prisma.payment.findMany({
        where: { status: PaymentStatus.PAID, createdAt: { gte: from, lt: to }, order: { tenantId, branchId } },
        include: { order: { select: { code: true, total: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.findMany({ where: { tenantId, branchId, createdAt: { gte: from, lt: to } }, select: { id: true, status: true, total: true, createdAt: true } }),
      prisma.orderItem.groupBy({ by: ['name'], where: { order: { tenantId, branchId, createdAt: { gte: from, lt: to }, status: OrderStatus.PAID } }, _sum: { quantity: true, total: true }, orderBy: { _sum: { total: 'desc' } }, take: 10 }),
    ]);

    const dailyMap = new Map<string, { date: string; revenue: number; orders: number; payments: number }>();
    const methodMap = new Map<string, number>();
    for (const payment of payments) {
      const date = payment.createdAt.toISOString().slice(0, 10);
      const current = dailyMap.get(date) || { date, revenue: 0, orders: 0, payments: 0 };
      current.revenue += Number(payment.amount || 0);
      current.payments += 1;
      dailyMap.set(date, current);
      methodMap.set(payment.method, (methodMap.get(payment.method) || 0) + Number(payment.amount || 0));
    }
    const ordersByDay = new Map<string, Set<string>>();
    orders.forEach((order) => {
      const date = order.createdAt.toISOString().slice(0, 10);
      if (!ordersByDay.has(date)) ordersByDay.set(date, new Set());
      ordersByDay.get(date)!.add(order.id);
    });
    for (const [date, set] of ordersByDay.entries()) {
      const current = dailyMap.get(date) || { date, revenue: 0, orders: 0, payments: 0 };
      current.orders = set.size;
      dailyMap.set(date, current);
    }
    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const revenue = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const paidOrders = orders.filter((order) => order.status === OrderStatus.PAID).length;
    const cancelledOrders = orders.filter((order) => order.status === OrderStatus.CANCELLED).length;
    const methods = [...methodMap.entries()].map(([method, amount]) => ({ method, amount }));
    res.json({
      from,
      to,
      summary: { revenue, orders: orders.length, paidOrders, cancelledOrders, payments: payments.length, averageOrder: paidOrders ? Math.round(revenue / paidOrders) : 0 },
      daily,
      methods,
      topProducts,
      recentPayments: payments.slice(0, 30),
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


function methodText(method: string) {
  const map: Record<string, string> = {
    CASH: 'Tiền mặt',
    BANK_TRANSFER: 'Chuyển khoản',
    CARD: 'Thẻ',
    E_WALLET: 'Ví điện tử',
    QR: 'QR',
  };
  return map[method] || method;
}

function moneyNumber(value: unknown) {
  return Number(value || 0);
}

function vnDate(value: Date) {
  return value.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function setupSheet(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function styleReportTitle(sheet: ExcelJS.Worksheet, title: string, mergeTo = 'H1') {
  sheet.mergeCells(`A1:${mergeTo}`);
  const cell = sheet.getCell('A1');
  cell.value = title;
  cell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  sheet.getRow(1).height = 28;
}

const reportBorder: any = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

function styleTable(sheet: ExcelJS.Worksheet, headerRow: number, fromCol: number, toCol: number, lastRow: number) {
  const header = sheet.getRow(headerRow);
  for (let col = fromCol; col <= toCol; col += 1) {
    const cell = header.getCell(col);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.border = reportBorder;
  }
  for (let rowIndex = headerRow + 1; rowIndex <= lastRow; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    for (let col = fromCol; col <= toCol; col += 1) {
      const cell = row.getCell(col);
      cell.border = reportBorder;
      cell.alignment = { vertical: 'middle', horizontal: col === fromCol ? 'left' : 'center', wrapText: true };
      if ((rowIndex - headerRow) % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }
  }
}

function addInfoRows(sheet: ExcelJS.Worksheet, rows: unknown[][], startRow: number) {
  rows.forEach((row, offset) => {
    const excelRow = sheet.getRow(startRow + offset);
    row.forEach((value, index) => {
      const cell = excelRow.getCell(index + 1);
      cell.value = value as any;
      cell.border = reportBorder;
      cell.alignment = { vertical: 'middle', horizontal: index % 2 === 0 ? 'left' : 'right', wrapText: true };
      if (index % 2 === 0) cell.font = { bold: true };
    });
  });
}

async function sendWorkbook(res: express.Response, workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}

app.get('/reports/revenue/export', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { from, to } = reportDateRange(req.query.from, req.query.to);
    const [tenant, branch, payments, orders, topProducts] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, address: true, phone: true, appName: true } }),
      prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, address: true, phone: true } }),
      prisma.payment.findMany({
        where: { status: PaymentStatus.PAID, createdAt: { gte: from, lt: to }, order: { tenantId, branchId } },
        include: { order: { select: { code: true, total: true, subtotal: true, discount: true, createdAt: true, table: { select: { name: true } }, cashier: { select: { fullName: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.findMany({ where: { tenantId, branchId, createdAt: { gte: from, lt: to } }, select: { id: true, status: true, total: true, discount: true } }),
      prisma.orderItem.groupBy({ by: ['name'], where: { order: { tenantId, branchId, createdAt: { gte: from, lt: to }, status: OrderStatus.PAID } }, _sum: { quantity: true, total: true }, orderBy: { _sum: { total: 'desc' } }, take: 20 }),
    ]);
    const revenue = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const discountTotal = orders.reduce((sum, order) => sum + Number(order.discount || 0), 0);
    const paidOrders = orders.filter((order) => order.status === OrderStatus.PAID).length;
    const cancelledOrders = orders.filter((order) => order.status === OrderStatus.CANCELLED).length;
    const methodTotals = payments.reduce<Record<string, number>>((acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + Number(payment.amount || 0);
      return acc;
    }, {});
    const dailyTotals = payments.reduce<Record<string, { revenue: number; payments: number }>>((acc, payment) => {
      const key = payment.createdAt.toISOString().slice(0, 10);
      acc[key] = acc[key] || { revenue: 0, payments: 0 };
      acc[key].revenue += Number(payment.amount || 0);
      acc[key].payments += 1;
      return acc;
    }, {});

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Stype POS';
    workbook.created = new Date();
    workbook.modified = new Date();

    const summary = workbook.addWorksheet('Tổng hợp');
    setupSheet(summary, [24, 20, 24, 20, 24, 20, 24, 20]);
    styleReportTitle(summary, 'BÁO CÁO DOANH THU - STYPE POS');
    addInfoRows(summary, [
      ['Tên quán', tenant?.name || '', 'Chi nhánh', branch?.name || '', 'Từ ngày', vnDate(from), 'Đến ngày', vnDate(to)],
      ['Địa chỉ quán', tenant?.address || branch?.address || '', 'SĐT', tenant?.phone || branch?.phone || '', 'Ngày xuất', vnDate(new Date()), 'Người xuất', req.user?.email || ''],
    ], 3);
    summary.addRow([]);
    const summaryHeaderRow = 6;
    summary.getRow(summaryHeaderRow).values = ['Chỉ số', 'Giá trị'];
    const summaryRows: Array<[string, number | string]> = [
      ['Tổng doanh thu đã thu', revenue],
      ['Số hóa đơn đã thanh toán', paidOrders],
      ['Số hóa đơn hủy', cancelledOrders],
      ['Tổng số giao dịch thanh toán', payments.length],
      ['Giá trị trung bình/hóa đơn', paidOrders ? Math.round(revenue / paidOrders) : 0],
      ['Tổng giảm giá', discountTotal],
    ];
    summaryRows.forEach((row) => summary.addRow(row));
    styleTable(summary, summaryHeaderRow, 1, 2, summaryHeaderRow + summaryRows.length);
    [7, 11, 12].forEach((row) => { summary.getRow(row).getCell(2).numFmt = '#,##0'; });

    const daily = workbook.addWorksheet('Doanh thu ngày');
    setupSheet(daily, [18, 18, 18]);
    styleReportTitle(daily, 'DOANH THU THEO NGÀY', 'C1');
    daily.getRow(3).values = ['Ngày', 'Doanh thu', 'Số giao dịch'];
    Object.entries(dailyTotals).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, data]) => daily.addRow([date, data.revenue, data.payments]));
    styleTable(daily, 3, 1, 3, Math.max(3, daily.rowCount));
    daily.getColumn(2).numFmt = '#,##0';

    const methods = workbook.addWorksheet('Phương thức');
    setupSheet(methods, [26, 20]);
    styleReportTitle(methods, 'DOANH THU THEO PHƯƠNG THỨC', 'B1');
    methods.getRow(3).values = ['Phương thức', 'Số tiền'];
    Object.entries(methodTotals).forEach(([method, amount]) => methods.addRow([methodText(method), amount]));
    styleTable(methods, 3, 1, 2, Math.max(3, methods.rowCount));
    methods.getColumn(2).numFmt = '#,##0';

    const products = workbook.addWorksheet('Top món');
    setupSheet(products, [36, 16, 20]);
    styleReportTitle(products, 'TOP MÓN BÁN CHẠY', 'C1');
    products.getRow(3).values = ['Tên món', 'Số lượng', 'Doanh thu'];
    topProducts.forEach((item) => products.addRow([item.name, item._sum.quantity || 0, moneyNumber(item._sum.total || 0)]));
    styleTable(products, 3, 1, 3, Math.max(3, products.rowCount));
    products.getColumn(3).numFmt = '#,##0';

    const details = workbook.addWorksheet('Chi tiết hóa đơn');
    setupSheet(details, [22, 18, 18, 24, 22, 20, 18, 18, 22]);
    styleReportTitle(details, 'CHI TIẾT THANH TOÁN', 'I1');
    details.getRow(3).values = ['Ngày thanh toán', 'Mã hóa đơn', 'Bàn/Kênh', 'Người gọi món', 'Phương thức', 'Số tiền', 'Tổng bill', 'Giảm giá', 'Mã giao dịch'];
    payments.forEach((payment) => details.addRow([
      vnDate(payment.createdAt),
      payment.order.code,
      payment.order.table?.name || 'Mang về',
      payment.order.cashier?.fullName || '',
      methodText(payment.method),
      Number(payment.amount || 0),
      Number(payment.order.total || 0),
      Number(payment.order.discount || 0),
      payment.reference || '',
    ]));
    styleTable(details, 3, 1, 9, Math.max(3, details.rowCount));
    [6, 7, 8].forEach((column) => { details.getColumn(column).numFmt = '#,##0'; });

    await sendWorkbook(res, workbook, `stype-pos-bao-cao-doanh-thu-${from.toISOString().slice(0,10)}-${to.toISOString().slice(0,10)}.xlsx`);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/reports/dashboard', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, monthOrders, topProducts, tableStats] = await Promise.all([
      prisma.order.findMany({ where: { tenantId, branchId, status: OrderStatus.PAID, createdAt: { gte: today } } }),
      prisma.order.findMany({ where: { tenantId, branchId, status: OrderStatus.PAID, createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } } }),
      prisma.orderItem.groupBy({ by: ['productId', 'name'], where: { order: { tenantId, branchId } }, _sum: { quantity: true, total: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
      prisma.diningTable.groupBy({ by: ['status'], where: { tenantId, branchId }, _count: true }),
    ]);

    const revenueToday = todayOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const revenueMonth = monthOrders.reduce((sum, order) => sum + Number(order.total), 0);

    res.json({
      revenueToday,
      revenueMonth,
      ordersToday: todayOrders.length,
      ordersMonth: monthOrders.length,
      topProducts,
      tableStats,
      aiInsight: revenueToday > 0 ? 'Doanh thu hôm nay đang có tín hiệu tốt. Nên đẩy combo bán chạy vào giờ cao điểm.' : 'Chưa có doanh thu hôm nay. Nên kiểm tra chiến dịch khuyến mãi hoặc hiển thị menu.',
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});


// ===== V15: realtime internal chat + private 1:1 chat =====
const chatMessageSchema = z.object({
  branchId: z.string().optional().nullable(),
  recipientId: z.string().optional().nullable(),
  content: z.string().min(1).max(1000),
});

app.get('/chat/contacts', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const users = await prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, fullName: true, email: true, role: true, avatarUrl: true, branchId: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
    res.json(users.filter((user) => user.id !== req.user!.sub));
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Không tải được danh sách nhân sự' });
  }
});

app.get('/chat/messages', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const mode = (req.query.mode as string) || 'branch';
    const recipientId = (req.query.recipientId as string) || '';
    const branchId = (req.query.branchId as string) || req.user?.branchId || undefined;

    let where: any;
    if (mode === 'private') {
      if (!recipientId) return res.status(400).json({ message: 'Thiếu người nhận tin nhắn riêng' });
      const recipient = await prisma.user.findFirst({ where: { id: recipientId, tenantId }, select: { id: true } });
      if (!recipient) return res.status(404).json({ message: 'Không tìm thấy tài khoản cần chat riêng' });
      where = {
        tenantId,
        OR: [
          { senderId: req.user!.sub, recipientId },
          { senderId: recipientId, recipientId: req.user!.sub },
        ],
      };
    } else {
      where = { tenantId, recipientId: null, ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}) };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      include: {
        sender: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
        recipient: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 160,
    });
    res.json(messages.reverse());
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Không tải được tin nhắn' });
  }
});

app.post('/chat/messages', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const parsed = chatMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Nội dung tin nhắn không hợp lệ' });
    const recipientId = parsed.data.recipientId || null;
    const branchId = recipientId ? null : (parsed.data.branchId || req.user?.branchId || null);

    if (recipientId) {
      const recipient = await prisma.user.findFirst({ where: { id: recipientId, tenantId }, select: { id: true } });
      if (!recipient) return res.status(404).json({ message: 'Không tìm thấy tài khoản nhận tin nhắn riêng' });
      if (recipientId === req.user!.sub) return res.status(400).json({ message: 'Không thể tự gửi tin nhắn riêng cho chính mình' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        tenantId,
        branchId,
        senderId: req.user!.sub,
        recipientId,
        content: parsed.data.content.trim(),
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
        recipient: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
      },
    });

    if (recipientId) {
      emitToUser(recipientId, 'chat.private_message_created', message);
      emitToUser(req.user!.sub, 'chat.private_message_created', message);
    } else {
      if (branchId) emitToBranch(branchId, 'chat.message_created', message);
      emitToTenant(tenantId, 'chat.message_created', message);
    }

    await writeAudit(req, recipientId ? 'SEND_PRIVATE_CHAT_MESSAGE' : 'SEND_CHAT_MESSAGE', 'CHAT', { messageId: message.id, branchId, recipientId });
    res.status(201).json(message);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Không gửi được tin nhắn' });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Lỗi hệ thống', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

const port = Number(process.env.PORT || 4000);
server.listen(port, '0.0.0.0', () => {
  console.log(`POS SaaS API listening on port ${port}`);
});
