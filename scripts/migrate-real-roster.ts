// One-off script: xóa toàn bộ dữ liệu demo, import danh bạ thật nhiệm kỳ 2025-2026 từ Excel
// Chạy: npx tsx scripts/migrate-real-roster.ts <đường_dẫn_file_excel>
import 'dotenv/config';
import { prisma } from '../server/db';
import { importRosterFromExcel } from '../server/importExcel';
import * as fs from 'fs';

async function main() {
  const excelPath = process.argv[2];
  if (!excelPath) {
    console.error('Usage: npx tsx scripts/migrate-real-roster.ts <file.xlsx>');
    process.exit(1);
  }

  console.log('Đang xóa dữ liệu demo cũ...');
  await prisma.$transaction([
    prisma.user.deleteMany(),
    prisma.task.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.notificationLog.deleteMany(),
    prisma.member.deleteMany(),
    prisma.term.deleteMany(),
  ]);

  console.log('Đang import:', excelPath);
  const buffer = fs.readFileSync(excelPath);
  const summary = await importRosterFromExcel(buffer, '2025-2026');

  console.log('=== KẾT QUẢ IMPORT ===');
  console.log(`Nhiệm kỳ: ${summary.term}`);
  console.log(`Tạo mới: ${summary.created} | Cập nhật: ${summary.updated} | Bỏ qua: ${summary.skipped}`);
  console.log('Theo ban:', JSON.stringify(summary.departments, null, 2));
  if (summary.skippedRows.length) {
    console.log('Bỏ qua chi tiết:');
    summary.skippedRows.forEach((r) => console.log('  -', r));
  }

  const counts = {
    members: await prisma.member.count(),
    users: await prisma.user.count(),
    terms: await prisma.term.count(),
  };
  console.log('Trạng thái DB:', counts);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
