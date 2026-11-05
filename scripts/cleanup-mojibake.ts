// Dọn dữ liệu test lỗi font từ curl (Git Bash Windows encoding)
import 'dotenv/config';
import { prisma } from '../server/db';

async function main() {
  // Xóa mọi task + meeting + notification của dữ liệu test (title có ký tự lỗi đặc trưng)
  const badTasks = await prisma.task.findMany();
  let t = 0;
  for (const task of badTasks) {
    if (!/[^\x00-\x7FÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸỴ]/.test(task.title.replace(/[a-zA-Z0-9 .:/,-]/g, ''))) {
      // toàn bộ ký tự đặc biệt ngoài bảng VN hợp lệ → nghi lỗi
    }
    // heuristic: chứa '?' cạnh chữ cái (dấu tiếng Việt bị thay) hoặc 'Thi?t/L�m' style
    if (/\?|\uFFFD/.test(task.title) || /Thi\?t|L.m |Ch\?t/.test(task.title)) {
      await prisma.notification.deleteMany({ where: { taskId: task.id } });
      await prisma.task.delete({ where: { id: task.id } });
      t++;
    }
  }
  const meetings = await prisma.meeting.findMany();
  let m = 0;
  for (const mt of meetings) {
    if (/\?|\uFFFD/.test(mt.title + mt.objectives)) {
      // xóa meeting không có task ràng buộc sau khi task đã xóa
      const still = await prisma.task.count({ where: { sourceMeetingId: mt.id } });
      if (still === 0) {
        await prisma.meeting.delete({ where: { id: mt.id } });
        m++;
      }
    }
  }
  const notifs = await prisma.notification.findMany();
  let n = 0;
  for (const no of notifs) {
    if (/\?|\uFFFD/.test(no.title + (no.body || ''))) {
      await prisma.notification.delete({ where: { id: no.id } });
      n++;
    }
  }
  console.log(`Đã xóa: ${t} tasks, ${m} meetings, ${n} notifications lỗi font`);
  console.log('Còn lại:', await prisma.task.count(), 'tasks ·', await prisma.meeting.count(), 'meetings ·', await prisma.notification.count(), 'notifications');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
