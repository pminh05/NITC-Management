import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tables = [
    ['User', prisma.user], ['Term', prisma.term], ['Member', prisma.member],
    ['Meeting', prisma.meeting], ['Notification', prisma.notification],
    ['NotificationPref', prisma.notificationPref], ['Task', prisma.task],
    ['NotificationLog', prisma.notificationLog], ['Setting', prisma.setting],
  ];
  for (const [name, model] of tables) {
    const n = await model.count();
    console.log(`${name}: ${n}`);
  }
  const byDept = await prisma.member.groupBy({ by: ['department'], _count: true });
  console.log('Member theo ban:', JSON.stringify(byDept));
  const byRole = await prisma.member.groupBy({ by: ['role'], _count: true });
  console.log('Member theo role:', JSON.stringify(byRole));
  const byStatus = await prisma.task.groupBy({ by: ['status'], _count: true });
  console.log('Task theo status:', JSON.stringify(byStatus));
}

main().catch(console.error).finally(() => prisma.$disconnect());
