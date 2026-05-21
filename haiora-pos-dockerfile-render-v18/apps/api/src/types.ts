import { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  tenantId?: string | null;
  branchId?: string | null;
  email: string;
  role: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
