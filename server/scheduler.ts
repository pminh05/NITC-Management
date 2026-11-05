import cron from 'node-cron';
import { prisma } from './db';
import { notify, notifyLeadership, departmentHead, sendEmailIfEnabled, getPref } from './notifications';

// ===== Bộ lập lịch tự động (G2) =====
// Cron: quét deadline 6h00 hằng ngày · digest email 20h00 · báo cáo tuần Chủ Nhật 21h00.
// Tắt bằng SCHEDULER_ENABLED=false khi dev/demo.

function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86400000);
}

/**
 * Quét deadline toàn hệ thống, sinh thông báo:
 *  - deadline = ngày mai  → deadline_tomorrow cho người được giao
 *  - deadline = hôm nay   → deadline_today cho người được giao
 *  - quá hạn              → overdue cho người được giao + Trưởng ban + Ban lãnh đạo (nhắc lại mỗi 2 ngày)
 * Idempotent: dedupeKey kiểu type:taskId:ngày — chạy lại không sinh trùng.
 */
export async function scanDeadlines(): Promise<{ tomorrow: number; today: number; overdue: number }> {
  const today = todayStr();
  const tomorrow = todayStr(new Date(Date.now() + 86400000));

  // Đồng bộ trạng thái DB: việc trễ hạn đánh dấu 'overdue' (pending_approval vẫn giữ
  // vì đang chờ Chủ nhiệm nghiệm thu, không phải lỗi của người làm)
  await prisma.task.updateMany({
    where: { deadline: { lt: today }, status: 'in_progress' },
    data: { status: 'overdue' },
  });

  const openTasks = await prisma.task.findMany({
    where: { status: { not: 'completed' } },
    include: { assignee: true },
  });

  let cTomorrow = 0, cToday = 0, cOverdue = 0;

  for (const task of openTasks) {
    const diff = daysBetween(today, task.deadline); // >0: còn bao nhiêu ngày, <0: trễ bao nhiêu ngày

    // Đa phụ trách: tất cả người trong assigneeIds đều nhận nhắc hẹn
    let assigneeIds: string[] = [task.assigneeId];
    try {
      const parsed = JSON.parse(task.assigneeIds);
      if (Array.isArray(parsed) && parsed.length > 0) assigneeIds = parsed;
    } catch {}

    if (diff === 1) {
      for (const memberId of assigneeIds) {
        await notify({
          memberId,
          type: 'deadline_tomorrow',
          title: '⏰ Ngày mai đến hạn',
          body: `"${task.title}" có hạn chót ngày ${task.deadline}. Vui lòng hoàn thành và nộp minh chứng.`,
          taskId: task.id,
          dedupeKey: `deadline_tomorrow:${task.id}:${memberId}:${today}`,
        });
      }
      cTomorrow++;
    } else if (diff === 0) {
      for (const memberId of assigneeIds) {
        await notify({
          memberId,
          type: 'deadline_today',
          title: '🔥 Hạn chót hôm nay',
          body: `"${task.title}" đến hạn hôm nay. Nộp minh chứng trước khi hết ngày!`,
          taskId: task.id,
          dedupeKey: `deadline_today:${task.id}:${memberId}:${today}`,
        });
      }
      cToday++;
    } else if (diff < 0) {
      const daysOverdue = Math.abs(diff);
      // Nhắc lại mỗi 2 ngày (daysOverdue lẻ → bỏ qua để tránh spam)
      if (daysOverdue % 2 === 1) continue;
      const head = await departmentHead(task.department);
      const recipients = new Set<string>([...assigneeIds]);
      if (head) recipients.add(head.id);

      for (const memberId of recipients) {
        await notify({
          memberId,
          type: 'overdue',
          title: `🚨 Quá hạn ${daysOverdue} ngày`,
          body: `"${task.title}" đã trễ hạn từ ${task.deadline} (ban ${task.department}). Cần nộp minh chứng hoặc báo Chủ nhiệm gia hạn.`,
          taskId: task.id,
          dedupeKey: `overdue:${task.id}:${memberId}:${today}`,
        });
      }
      // Ban lãnh đạo nhận cảnh báo tổng (không theo từng người làm)
      await notifyLeadership({
        type: 'overdue',
        title: `🚨 Việc quá hạn tại ban ${task.department}`,
        body: `"${task.title}" — giao cho ${task.assigneeName} — đã trễ ${daysOverdue} ngày (hạn ${task.deadline}).`,
        taskId: task.id,
        dedupeKey: `overdue_leader:${task.id}:${today}`,
      });
      cOverdue++;
    }
  }

  return { tomorrow: cTomorrow, today: cToday, overdue: cOverdue };
}

/**
 * Email tổng hợp 20h: gom thông báo chưa đọc của ngày gửi 1 email duy nhất
 * cho thành viên chọn kênh 'digest'.
 */
export async function sendDigestEmails(): Promise<number> {
  if (process.env.EMAIL_ENABLED !== 'true') return 0;
  const members = await prisma.member.findMany({
    where: { status: 'active', notificationPref: { channel: 'digest' } },
  });
  let sent = 0;
  for (const m of members) {
    const unread = await prisma.notification.findMany({
      where: { memberId: m.id, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    if (unread.length === 0) continue;
    const body = unread
      .map((n, i) => `${i + 1}. ${n.title}${n.body ? `\n   ${n.body}` : ''}`)
      .join('\n\n');
    const ok = await sendEmailIfEnabled(
      m.email,
      `[NITC] Tổng hợp ${unread.length} thông báo chưa đọc`,
      `Chào ${m.name},\n\nBạn có ${unread.length} thông báo chưa đọc trên NITC Command Center:\n\n${body}\n\n— Gửi tự động 20h00 bởi NITC Command Center`
    );
    if (ok) sent++;
  }
  return sent;
}

/**
 * Báo cáo tuần Chủ Nhật 21h: tổng hợp tiến độ các ban, lưu thành thông báo
 * cho Ban lãnh đạo + gửi email (nếu bật).
 */
export async function weeklyReport(): Promise<void> {
  const tasks = await prisma.task.findMany();
  const byDept = new Map<string, { total: number; done: number; overdue: number }>();
  for (const t of tasks) {
    const d = byDept.get(t.department) || { total: 0, done: 0, overdue: 0 };
    d.total++;
    if (t.status === 'completed') d.done++;
    if (t.status === 'overdue') d.overdue++;
    byDept.set(t.department, d);
  }
  const lines = [...byDept.entries()]
    .map(([dept, d]) => `• ${dept}: ${d.done}/${d.total} hoàn thành${d.overdue > 0 ? ` — ${d.overdue} việc quá hạn` : ''}`)
    .join('\n');
  const totalOverdue = tasks.filter((t) => t.status === 'overdue').length;

  await notifyLeadership({
    type: 'weekly_summary',
    title: '📊 Báo cáo tuần — tiến độ toàn CLB',
    body: `Tổng kết tuần (tổng cộng ${totalOverdue} việc quá hạn):\n${lines}\n\nXem chi tiết trong mục Nhắc việc.`,
    dedupeKey: `weekly_summary:${todayStr()}`,
  });

  if (process.env.EMAIL_ENABLED === 'true') {
    const leaders = await prisma.member.findMany({
      where: { role: { in: ['Chủ nhiệm', 'Phó Chủ nhiệm'] }, status: 'active' },
    });
    for (const l of leaders) {
      if ((await getPref(l.id)) !== 'in_app') {
        await sendEmailIfEnabled(l.email, '[NITC] Báo cáo tuần Ban Điều hành', `Chào ${l.name},\n\n${lines}\n\n— NITC Command Center`);
      }
    }
  }
}

export function startScheduler(): void {
  if (process.env.SCHEDULER_ENABLED === 'false') {
    console.log('⏸ Scheduler tắt (SCHEDULER_ENABLED=false)');
    return;
  }
  // Quét deadline 6h00 hằng ngày — giờ VN
  cron.schedule('0 6 * * *', async () => {
    const r = await scanDeadlines();
    console.log(`[cron 6h] Quét deadline: +${r.tomorrow} mai, +${r.today} hôm nay, ${r.overdue} quá hạn`);
  });
  // Digest email 20h00
  cron.schedule('0 20 * * *', async () => {
    const n = await sendDigestEmails();
    console.log(`[cron 20h] Digest email: ${n} người`);
  });
  // Báo cáo tuần 21h00 Chủ Nhật
  cron.schedule('0 21 * * 0', async () => {
    await weeklyReport();
    console.log('[cron CN 21h] Đã tạo báo cáo tuần');
  });
  console.log('✔ Scheduler khởi động: quét deadline 6h · digest 20h · báo cáo tuần CN 21h');
}
