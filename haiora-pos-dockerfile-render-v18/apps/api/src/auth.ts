import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { JwtPayload } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Thiếu token đăng nhập' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Chưa đăng nhập' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Không đủ quyền truy cập' });
    }
    return next();
  };
}

export function getTenantId(req: Request) {
  if (!req.user?.tenantId) {
    throw new Error('Tài khoản chưa gắn tenant');
  }
  return req.user.tenantId;
}

export function getBranchId(req: Request) {
  const branchId = (req.query.branchId as string) || req.body.branchId || req.user?.branchId;
  if (!branchId) {
    throw new Error('Thiếu branchId');
  }
  return branchId;
}
