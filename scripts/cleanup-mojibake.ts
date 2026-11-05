// Dọn dữ liệu test lỗi font (mã hóa Windows console làm hỏng ký tự tiếng Việt)
import 'dotenv/config';
import { prisma } from '../server/db';

async function main() {
  const bad = await prisma.task.findMany();
  for (const t of bad) {
    if (!t.title.includes('Thi?t')) continue;
    await prisma.notification.deleteMany({ where: { taskId: t.id } });
    await prisma.task.delete({ where: { id: t.id } });
    console.log('Đã xóa task lỗi font:', t.id);
  }
  const notifs = await prisma.notification.findMany();
  let removed = 0;
  for (const n of notifs) {
    if ((n.title + (n.body || '')).includes('Thi?t')) {
      await prisma.notification.delete({ where: { id: n.id } });
      removed++;
    }
  }
  console.log('Đã xóa', removed, 'thông báo lỗi font');
  console.log('Còn lại:', await prisma.task.count(), 'tasks ·', await prisma.notification.count(), 'notifications');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
