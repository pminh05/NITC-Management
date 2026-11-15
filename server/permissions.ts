// Lớp phân quyền phía server: dùng lại ma trận ở shared/permissions.ts (giao diện cũng dùng đúng tệp đó)
// + middleware Express + lọc thông tin riêng của thành viên.
import { NextFunction, Request, Response } from 'express';
import { HttpError } from './http';
import { Actor, canViewMemberPrivate } from '../shared/permissions';
import { serializeMember } from './serialize';

export * from '../shared/permissions';

/** Middleware: chỉ cho qua khi người đăng nhập thỏa điều kiện quyền; ngược lại 403 kèm thông báo. */
export function requireCan(check: (actor: Actor) => boolean, message: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authMember || !check(req.authMember)) {
      return next(new HttpError(403, message, 'FORBIDDEN'));
    }
    return next();
  };
}

/** Ném 403 nếu không đủ quyền (dùng trong thân handler, khi điều kiện phụ thuộc bản ghi cụ thể). */
export function assertCan(allowed: boolean, message: string): void {
  if (!allowed) throw new HttpError(403, message, 'FORBIDDEN');
}

type MemberRow = Parameters<typeof serializeMember>[0];

/**
 * Hồ sơ thành viên theo người xem: ai không có quyền xem thông tin riêng chỉ nhận
 * họ tên, ban, chức vụ, email (đủ để giao việc, liên hệ) — không có SĐT, MSV, lớp, ngày sinh.
 */
export function serializeMemberFor(viewer: Actor, m: MemberRow) {
  const full = serializeMember(m);
  if (canViewMemberPrivate(viewer, m)) return full;
  return {
    id: full.id,
    name: full.name,
    role: full.role,
    department: full.department,
    email: full.email,
    status: full.status,
    termId: full.termId,
  };
}
