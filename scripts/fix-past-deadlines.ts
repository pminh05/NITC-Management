// One-time: chuẩn hóa deadline quá khứ trong DB về lần xuất hiện kế tiếp (quy tắc mới)
import 'dotenv/config';
import { prisma } from '../server/db';

function normalizeFutureDeadline(dateStr: string, todayIso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  let d = dateStr;
  let guard = 0;
  while (d < todayIso && guard < 12) {
    d = `${Number(d.slice(0, 4)) + 1}${d.slice(4)}`;
    guard++;
  }
  return d;
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const bad = await prisma.task.findMany({
    where: { deadline: { lt: today }, status: { not: 'completed' } },
  });
  for (const t of bad) {
    const fixed = normalizeFutureDeadline(t.deadline, today);
    await prisma.task.update({ where: { id: t.id }, data: { deadline: fixed, status: 'in_progress' } });
    console.log(`Đã sửa: "${t.title.slice(0, 40)}" ${t.deadline} -> ${fixed}`);
  }
  console.log(`Tổng cộng sửa ${bad.length} việc.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
