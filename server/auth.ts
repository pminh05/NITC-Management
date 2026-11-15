import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './db';
import { config } from './config';
import { HttpError, validate } from './http';
import { changePasswordSchema, loginSchema } from './schemas';
import { capabilitiesOf } from '../shared/permissions';

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
      authUserId?: string;
      mustChangePassword?: boolean;
    }
  }
}

interface TokenPayload {
  sub: string;
  memberId?: string | null;
  /** Dấu vân tay của mật khẩu lúc cấp token — đổi mật khẩu là mọi token cũ hết hiệu lực. */
  pv?: string;
  /** Token cấp khi đăng nhập bằng mật khẩu mặc định → phải đổi mật khẩu trước khi dùng (trừ chế độ demo). */
  dp?: boolean;
}

function passwordFingerprint(passwordHash: string): string {
  return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

export function signToken(
  user: { id: string; memberId: string | null; passwordHash: string },
  usedDefaultPassword: boolean
): string {
  const payload: TokenPayload = {
    sub: user.id,
    memberId: user.memberId,
    pv: passwordFingerprint(user.passwordHash),
    ...(usedDefaultPassword ? { dp: true } : {}),
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.tokenTtl } as jwt.SignOptions);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
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

// ----- Chặn dò mật khẩu (đếm số lần sai theo email và theo IP, lưu trong bộ nhớ) -----

const loginFailures = new Map<string, { count: number; windowStart: number }>();

function failureState(key: string): { count: number; windowStart: number } | null {
  const s = loginFailures.get(key);
  if (!s) return null;
  if (Date.now() - s.windowStart > config.loginWindowMs) {
    loginFailures.delete(key);
    return null;
  }
  return s;
}

/** Số phút còn bị khóa (0 = không khóa). */
function lockedMinutes(key: string, max: number): number {
  const s = failureState(key);
  if (!s || s.count < max) return 0;
  return Math.max(1, Math.ceil((config.loginWindowMs - (Date.now() - s.windowStart)) / 60000));
}

function recordFailure(key: string): void {
  const s = failureState(key);
  if (s) s.count += 1;
  else loginFailures.set(key, { count: 1, windowStart: Date.now() });
  // Dọn bộ đếm đã hết hạn để Map không phình vô hạn
  if (loginFailures.size > 5000) {
    for (const k of [...loginFailures.keys()]) failureState(k);
  }
}

// Hash giả để thời gian phản hồi "email không tồn tại" giống "sai mật khẩu" (không lộ email nào có tài khoản)
const DUMMY_HASH = bcrypt.hashSync('nitc-dummy-password-for-timing', 10);

// ----- Routes -----

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = validate(loginSchema, req.body);
  const emailKey = `email:${email}`;
  const ipKey = `ip:${req.ip || 'unknown'}`;

  const locked = Math.max(
    lockedMinutes(emailKey, config.loginMaxFailuresPerEmail),
    lockedMinutes(ipKey, config.loginMaxFailuresPerIp)
  );
  if (locked > 0) {
    throw new HttpError(429, `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${locked} phút.`, 'TOO_MANY_ATTEMPTS');
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { member: true } });
  const passwordOk = await verifyPassword(password, user?.passwordHash || DUMMY_HASH);

  if (!user || !passwordOk) {
    recordFailure(emailKey);
    recordFailure(ipKey);
    throw new HttpError(401, 'Email hoặc mật khẩu không đúng');
  }
  if (!user.member || user.member.status !== 'active') {
    throw new HttpError(403, 'Tài khoản không còn hoạt động. Liên hệ Ban Chủ nhiệm.', 'ACCOUNT_INACTIVE');
  }

  loginFailures.delete(emailKey);
  const usedDefaultPassword = password === config.defaultPassword;
  return res.json({
    token: signToken(user, usedDefaultPassword),
    member: toAuthMember(user.member),
    capabilities: capabilitiesOf(user.member),
    mustChangePassword: usedDefaultPassword && !config.demoMode,
  });
}

export async function meHandler(req: Request, res: Response) {
  // requireAuthAllowPending đã gắn authMember
  return res.json({
    member: req.authMember,
    capabilities: capabilitiesOf(req.authMember!),
    mustChangePassword: Boolean(req.mustChangePassword),
  });
}

/** Đổi mật khẩu của chính mình — trả token mới (token cũ hết hiệu lực vì dấu vân tay mật khẩu đã đổi). */
export async function changePasswordHandler(req: Request, res: Response) {
  const { currentPassword, newPassword } = validate(changePasswordSchema, req.body);
  const user = await prisma.user.findUnique({ where: { id: req.authUserId! }, include: { member: true } });
  if (!user || !user.member) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ', 'SESSION_INVALID');

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Mật khẩu hiện tại không đúng');
  }
  if (newPassword === config.defaultPassword) {
    throw new HttpError(400, 'Không được dùng lại mật khẩu mặc định. Hãy chọn mật khẩu khác.');
  }
  if (newPassword === currentPassword) {
    throw new HttpError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  return res.json({
    token: signToken(updated, false),
    member: toAuthMember(user.member),
    capabilities: capabilitiesOf(user.member),
    mustChangePassword: false,
  });
}

/**
 * Thông tin công khai cho trang đăng nhập. Chỉ khi DEMO_MODE=true mới trả danh sách
 * tài khoản đăng nhập nhanh — môi trường dùng thật không lộ email/mật khẩu nào.
 */
export async function authConfigHandler(_req: Request, res: Response) {
  if (!config.demoMode) return res.json({ demoMode: false, demoAccounts: [] });

  const members = await prisma.member.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
    select: { name: true, role: true, department: true, email: true },
  });
  const pick = (role: string, dept?: string) => members.find((m) => m.role === role && (!dept || m.department === dept));
  const candidates = [
    { m: pick('Chủ nhiệm'), icon: '👑' },
    { m: pick('Phó Chủ nhiệm'), icon: '🌟' },
    { m: pick('Trưởng ban', 'Sự kiện') || pick('Trưởng ban'), icon: '📅' },
    { m: pick('Trưởng ban', 'Học thuật'), icon: '🎓' },
    { m: pick('Thành viên', 'Truyền thông') || pick('Thành viên'), icon: '📢' },
  ];
  const seen = new Set<string>();
  const demoAccounts: { label: string; email: string; icon: string }[] = [];
  for (const c of candidates) {
    if (!c.m || seen.has(c.m.email)) continue;
    seen.add(c.m.email);
    demoAccounts.push({
      label: `${c.m.role}${c.m.department !== 'Ban Chủ nhiệm' ? ` ${c.m.department}` : ''} — ${c.m.name}`,
      email: c.m.email,
      icon: c.icon,
    });
  }
  return res.json({ demoMode: true, demoAccounts, demoPassword: config.defaultPassword });
}

// ----- Xác thực token -----

/**
 * Kiểm tra token và trả về thành viên. Ngoài chữ ký + hạn dùng còn kiểm tra:
 *  - tài khoản còn "active" (khóa tài khoản có hiệu lực ngay, không đợi token hết hạn)
 *  - mật khẩu chưa đổi kể từ lúc cấp token
 */
export async function authenticateToken(
  token: string
): Promise<{ userId: string; member: AuthMember; mustChangePassword: boolean }> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as unknown as TokenPayload;
  } catch {
    throw new HttpError(401, 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại', 'SESSION_INVALID');
  }
  const user = await prisma.user.findUnique({ where: { id: String(payload.sub) }, include: { member: true } });
  if (!user || !user.member) {
    throw new HttpError(401, 'Phiên đăng nhập không hợp lệ', 'SESSION_INVALID');
  }
  if (user.member.status !== 'active') {
    throw new HttpError(401, 'Tài khoản không còn hoạt động. Liên hệ Ban Chủ nhiệm.', 'ACCOUNT_INACTIVE');
  }
  if (payload.pv !== passwordFingerprint(user.passwordHash)) {
    throw new HttpError(401, 'Mật khẩu đã được thay đổi, vui lòng đăng nhập lại', 'SESSION_INVALID');
  }
  return {
    userId: user.id,
    member: toAuthMember(user.member),
    mustChangePassword: Boolean(payload.dp) && !config.demoMode,
  };
}

function makeAuthMiddleware(allowPendingPasswordChange: boolean) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) throw new HttpError(401, 'Chưa đăng nhập', 'SESSION_INVALID');

      const auth = await authenticateToken(token);
      if (auth.mustChangePassword && !allowPendingPasswordChange) {
        throw new HttpError(
          403,
          'Bạn cần đổi mật khẩu mặc định trước khi sử dụng hệ thống',
          'PASSWORD_CHANGE_REQUIRED'
        );
      }
      req.authMember = auth.member;
      req.authUserId = auth.userId;
      req.mustChangePassword = auth.mustChangePassword;
      next();
    } catch (e) {
      next(e);
    }
  };
}

// ----- Middleware -----

/** Bắt buộc đăng nhập; tài khoản còn dùng mật khẩu mặc định bị chặn (trừ chế độ demo). */
export const requireAuth = makeAuthMiddleware(false);

/** Như requireAuth nhưng cho qua tài khoản đang chờ đổi mật khẩu — chỉ dùng cho /auth/me và đổi mật khẩu. */
export const requireAuthAllowPending = makeAuthMiddleware(true);

// Quy tắc phân quyền nghiệp vụ nằm ở shared/permissions.ts (server dùng qua server/permissions.ts).
