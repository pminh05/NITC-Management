import cron, { ScheduledTask } from 'node-cron';
import { prisma } from './db';
import { notify, notifyLeadership, departmentHead, sendEmailIfEnabled, getPref } from './notifications';
import { getSettings } from './settings';
import { VN_TIMEZONE, addDays, diffDays, todayVN } from '../shared/time';
import { effectiveStatus } from '../shared/taskState';
import { taskAssigneeIds } from '../shared/permissions';

// ===== Bộ lập lịch tự động (G2) =====
// Cron: quét deadline 6h00 hằng ngày · digest email 20h00 · báo cáo tuần Chủ Nhật 21h00.
// Tắt bằng SCHEDULER_ENABLED=false khi dev/demo.
// Mọi lịch chạy và mọi phép so ngày đều theo giờ Việt Nam (shared/time.ts), không phụ thuộc múi giờ máy chủ.

const CRON_OPTS = { timezone: VN_TIMEZONE };

/**
 * Quét deadline toàn hệ thống, sinh thông báo:
 *  - deadline = ngày mai  → deadline_tomorrow cho người được giao
 *  - deadline = hôm nay   → deadline_today cho người được giao
 *  - quá hạn              → overdue cho người được giao + Trưởng ban + Ban lãnh đạo (nhắc lại mỗi 2 ngày)
 * Idempotent: dedupeKey kiểu type:taskId:ngày — chạy lại không sinh trùng.
 */
export async function scanDeadlines(): Promise<{ tomorrow: number; today: number; overdue: number }> {
  const today = todayVN();

  // Chỉ nhắc việc còn mở (đang làm / quá hạn). Việc đã nộp minh chứng đang chờ duyệt thì không nhắc người làm nữa.
  // "Quá hạn" được tính theo hạn chót lúc đọc (shared/taskState.ts) nên không cần ghi trạng thái vào CSDL.
  const openTasks = await prisma.task.findMany({
    where: { status: { in: ['in_progress', 'overdue'] } },
  });

  let cTomorrow = 0, cToday = 0, cOverdue = 0;

  for (const task of openTasks) {
    const diff = diffDays(today, task.deadline); // >0: còn bao nhiêu ngày, <0: trễ bao nhiêu ngày

    // Đa phụ trách: tất cả người trong assigneeIds đều nhận nhắc hẹn
    const assigneeIds = taskAssigneeIds(task);

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
    if (effectiveStatus(t) === 'overdue') d.overdue++;
    byDept.set(t.department, d);
  }
  const lines = [...byDept.entries()]
    .map(([dept, d]) => `• ${dept}: ${d.done}/${d.total} hoàn thành${d.overdue > 0 ? ` — ${d.overdue} việc quá hạn` : ''}`)
    .join('\n');
  const totalOverdue = tasks.filter((t) => effectiveStatus(t) === 'overdue').length;

  await notifyLeadership({
    type: 'weekly_summary',
    title: '📊 Báo cáo tuần — tiến độ toàn CLB',
    body: `Tổng kết tuần (tổng cộng ${totalOverdue} việc quá hạn):\n${lines}\n\nXem chi tiết trong mục Nhắc việc.`,
    dedupeKey: `weekly_summary:${todayVN()}`,
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

/** Bọc job cron: lỗi (CSDL bận, SMTP hỏng...) chỉ ghi log, không lan ra thành unhandledRejection. */
function safeJob(name: string, job: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await job();
    } catch (e) {
      console.error(`[cron] Job "${name}" lỗi:`, e);
    }
  };
}

let weeklyJob: ScheduledTask | null = null;

/** Đặt lại lịch báo cáo tuần khi Cấu hình thay đổi (không cần restart) */
export async function rescheduleWeeklyReport(): Promise<void> {
  const s = await getSettings();
  const cronExpr = `0 ${s.reportHour} * * ${s.reportDayOfWeek}`;
  if (weeklyJob) weeklyJob.stop();
  weeklyJob = cron.schedule(
    cronExpr,
    safeJob('báo cáo tuần', async () => {
      await weeklyReport();
      console.log('[cron] Đã tạo báo cáo tuần');
    }),
    CRON_OPTS
  );
  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  console.log(`[cron] Báo cáo tuần: ${dayNames[s.reportDayOfWeek]} ${s.reportHour}h`);
}

export function startScheduler(): void {
  if (process.env.SCHEDULER_ENABLED === 'false') {
    console.log('⏸ Scheduler tắt (SCHEDULER_ENABLED=false)');
    return;
  }
  // Quét deadline 6h00 hằng ngày — giờ VN
  cron.schedule(
    '0 6 * * *',
    safeJob('quét deadline', async () => {
      const r = await scanDeadlines();
      console.log(`[cron 6h] Quét deadline: +${r.tomorrow} mai, +${r.today} hôm nay, ${r.overdue} quá hạn`);
    }),
    CRON_OPTS
  );
  // Digest email 20h00
  cron.schedule(
    '0 20 * * *',
    safeJob('digest email', async () => {
      const n = await sendDigestEmails();
      console.log(`[cron 20h] Digest email: ${n} người`);
    }),
    CRON_OPTS
  );
  // Báo cáo tuần — lịch đọc từ Cấu hình (mặc định Chủ nhật 21h)
  rescheduleWeeklyReport().catch((e) => console.error('[cron] Không đặt được lịch báo cáo tuần:', e));
  console.log('✔ Scheduler khởi động: quét deadline 6h · digest 20h · báo cáo tuần theo Cấu hình');
}
