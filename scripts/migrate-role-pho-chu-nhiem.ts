// Migration: 'Phó Chủ tịch' -> 'Phó Chủ nhiệm' trong dữ liệu (đồng bộ danh xưng mới)
import 'dotenv/config';
import { prisma } from '../server/db';

async function main() {
  const r = await prisma.member.updateMany({
    where: { role: 'Phó Chủ tịch' },
    data: { role: 'Phó Chủ nhiệm' },
  });
  console.log('DB: đã đổi', r.count, 'thành viên Phó Chủ tịch -> Phó Chủ nhiệm');

  const roles = await prisma.member.groupBy({ by: ['role'], _count: true });
  console.log('Phân bố role:', roles.map((x) => `${x.role}:${x._count}`).join(', '));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
