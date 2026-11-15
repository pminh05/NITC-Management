// Sao lưu CSDL SQLite: tạo bản chụp nhất quán vào prisma/backups/ (VACUUM INTO — an toàn cả khi server đang chạy).
// Chạy: npm run db:backup
import 'dotenv/config';
import { mkdirSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupDir = path.join(root, 'prisma', 'backups');
mkdirSync(backupDir, { recursive: true });

const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const target = path.join(backupDir, `dev-${stamp}.db`);

const prisma = new PrismaClient();
try {
  // Đường dẫn do script tự sinh (không lấy từ người dùng) nên nối chuỗi an toàn; chỉ cần escape dấu nháy đơn.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/\\/g, '/').replace(/'/g, "''")}'`);
  const size = statSync(target).size;
  const count = readdirSync(backupDir).filter((f) => f.endsWith('.db')).length;
  console.log(`✔ Đã sao lưu CSDL: ${path.relative(root, target)} (${(size / 1024).toFixed(0)} KB) — hiện có ${count} bản sao lưu`);
} catch (e) {
  console.error('✘ Sao lưu thất bại:', e?.message || e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
