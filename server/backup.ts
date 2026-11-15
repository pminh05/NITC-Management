import fs from 'fs';
import path from 'path';
import { prisma } from './db';

// ===== Sao lưu CSDL SQLite =====
// VACUUM INTO tạo một bản chụp nhất quán ngay cả khi server đang phục vụ request.
// Bản sao lưu nằm cạnh tệp CSDL: <thư mục chứa .db>/backups/

function databaseFilePath(): string {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  const raw = url.replace(/^file:/, '');
  // Prisma hiểu đường dẫn tương đối theo thư mục prisma/ (nơi đặt schema.prisma)
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), 'prisma', raw);
}

/** Sao lưu toàn bộ CSDL; trả về đường dẫn tệp sao lưu. `reason` chỉ dùng đặt tên tệp. */
export async function backupDatabase(reason: string): Promise<string> {
  const dbFile = databaseFilePath();
  const dir = path.join(path.dirname(dbFile), 'backups');
  fs.mkdirSync(dir, { recursive: true });

  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const safeReason = reason.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30) || 'manual';
  const target = path.join(dir, `${path.basename(dbFile, '.db')}-${stamp}-${safeReason}.db`);

  // Đường dẫn do server tự sinh (không lấy từ người dùng); chỉ cần escape dấu nháy đơn.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/\\/g, '/').replace(/'/g, "''")}'`);
  return target;
}
