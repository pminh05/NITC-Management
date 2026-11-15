import 'dotenv/config';
import crypto from 'crypto';

// ===== Cấu hình tập trung từ biến môi trường =====
// Mọi module đọc cấu hình qua đây — không tự đọc process.env và không có giá trị bí mật viết cứng trong mã.

const isProd = process.env.NODE_ENV === 'production';

/** Các giá trị mẫu từng xuất hiện trong mã nguồn/.env.example — coi như chưa cấu hình. */
const KNOWN_PUBLIC_SECRETS = new Set([
  'change-me-in-production',
  'nitc-command-center-dev-secret-change-in-production',
]);

function resolveJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || '').trim();
  const usable = secret.length >= 32 && !KNOWN_PUBLIC_SECRETS.has(secret);
  if (usable) return secret;

  const reason = !secret
    ? 'chưa đặt JWT_SECRET'
    : KNOWN_PUBLIC_SECRETS.has(secret)
      ? 'JWT_SECRET đang là giá trị mẫu công khai'
      : 'JWT_SECRET quá ngắn (cần ít nhất 32 ký tự)';
  const howTo =
    'Sinh khóa: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))" rồi đặt JWT_SECRET="..." trong .env';

  if (isProd) {
    // Môi trường thật: không cho chạy với khóa yếu — ai biết khóa đều giả mạo được phiên đăng nhập.
    console.error(`✘ Không thể khởi động: ${reason}. ${howTo}`);
    process.exit(1);
  }
  console.warn(
    `⚠ ${reason} — dùng khóa ngẫu nhiên tạm cho lần chạy này (mọi phiên đăng nhập sẽ mất khi khởi động lại). ${howTo}`
  );
  return crypto.randomBytes(48).toString('hex');
}

export const config = {
  isProd,
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  jwtSecret: resolveJwtSecret(),
  tokenTtl: '7d',

  /** Mật khẩu khởi tạo cho tài khoản mới / sau khi Chủ nhiệm đặt lại. */
  defaultPassword: 'nitc123',

  /**
   * Chế độ trình diễn: hiện nút đăng nhập nhanh và KHÔNG buộc đổi mật khẩu mặc định.
   * Chỉ bật khi demo/bảo vệ khóa luận — môi trường dùng thật phải để false.
   */
  demoMode: process.env.DEMO_MODE === 'true',

  /** Cho phép "Reset demo" và "Import toàn bộ" (xóa sạch dữ liệu hiện có). Mặc định khóa. */
  allowDestructiveAdmin: process.env.ALLOW_DESTRUCTIVE_ADMIN === 'true',

  /** Chặn dò mật khẩu: số lần sai tối đa trong một cửa sổ thời gian. */
  loginMaxFailuresPerEmail: 5,
  loginMaxFailuresPerIp: 30,
  loginWindowMs: 15 * 60 * 1000,
};
