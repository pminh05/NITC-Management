// Hoàn nguyên 3 deadline về hạn cũ (user yêu cầu giữ hạn cũ cho người up tự kiểm)
import 'dotenv/config';
import { prisma } from '../server/db';

const fix: Record<string, string> = {
  'Hỗ trợ các em trong lớp': '2025-10-16',
  'Đăng tài liệu lên group': '2025-10-20',
  'Thiết kế lại buổi học': '2025-10-21',
};

async function main() {
  for (const [title, deadline] of Object.entries(fix)) {
    const t = await prisma.task.findFirst({ where: { title: { startsWith: title } } });
    if (t && t.deadline.startsWith('2027')) {
      await prisma.task.update({ where: { id: t.id }, data: { deadline, status: 'overdue' } });
      console.log('Hoàn nguyên:', title, '->', deadline, '(status: overdue)');
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
