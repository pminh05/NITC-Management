import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'nitc-command-center-dev-secret-change-in-production';
const TOKEN_TTL = '7d';

export interface AuthMember {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string | null;
  status: string;
}

// Mở rộng Request của Express với thành viên đã đăng nhập
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authMember?: AuthMember;
    }
  }
}

export function signToken(user: { id: string; memberId: string | null }): string {
  return jwt.sign({ sub: user.id, memberId: user.memberId }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  } as jwt.SignOptions);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

// ----- Routes -----

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
    include: { member: true },
  });

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
  }
  if (!user.member || user.member.status !== 'active') {
    return res.status(403).json({ error: 'Tài khoản không còn hoạt động. Liên hệ Ban Chủ nhiệm.' });
  }

  const token = signToken({ id: user.id, memberId: user.memberId });
  return res.json({ token, member: toAuthMember(user.member) });
}

export async function meHandler(req: Request, res: Response) {
  // requireAuth đã gắn authMember
  return res.json({ member: req.authMember });
}

export function toAuthMember(m: {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string | null;
  status: string;
}): AuthMember {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    department: m.department,
    email: m.email,
    phone: m.phone,
    status: m.status,
  };
}

// ----- Middleware -----

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; memberId?: string | null };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { member: true },
    });
    if (!user || !user.member) {
      return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ' });
    }
    req.authMember = toAuthMember(user.member);
    return next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại' });
  }
}

export function requirePresident(req: Request, res: Response, next: NextFunction) {
  if (req.authMember?.role !== 'Chủ tịch') {
    return res.status(403).json({ error: 'Chỉ Chủ tịch mới được thực hiện thao tác này' });
  }
  return next();
}

export function requirePresidentOrHead(req: Request, res: Response, next: NextFunction) {
  const role = req.authMember?.role;
  if (role !== 'Chủ tịch' && role !== 'Trưởng ban' && role !== 'Phó ban') {
    return res.status(403).json({ error: 'Chỉ Chủ tịch hoặc Trưởng ban/Phó ban được thao tác này' });
  }
  return next();
}

// ----- Quyền nghiệp vụ -----

export function isPresident(m?: AuthMember): boolean {
  return m?.role === 'Chủ tịch';
}

/** Trưởng ban / Phó ban được quản lý công việc trong phạm vi ban mình */
export function canManageDepartment(m: AuthMember, department: string): boolean {
  if (isPresident(m)) return true;
  if (m.role === 'Trưởng ban' || m.role === 'Phó ban') {
    return m.department === department;
  }
  return false;
}

/** Thành viên thấy: việc của ban mình + việc giao cho chính mình */
export function canViewTask(m: AuthMember, task: { department: string; assigneeId: string }): boolean {
  if (isPresident(m)) return true;
  return task.department === m.department || task.assigneeId === m.id;
}
