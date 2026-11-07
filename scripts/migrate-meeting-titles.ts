// Migration: đổi 'BBH' -> 'Họp' trong tiêu đề các kỳ họp hiện có
import 'dotenv/config';
import { prisma } from '../server/db';

async function main() {
  const meetings = await prisma.meeting.findMany({ where: { title: { contains: 'BBH' } } });
  for (const m of meetings) {
    const newTitle = m.title.replace(/BBH/g, 'Họp');
    await prisma.meeting.update({ where: { id: m.id }, data: { title: newTitle } });
    console.log(`"${m.title}" -> "${newTitle}"`);
  }
  console.log(`Đã đổi ${meetings.length} tiêu đề.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
