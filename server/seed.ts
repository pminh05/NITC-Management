import { prisma } from './db';
import { hashPassword } from './auth';
import { INITIAL_MEMBERS, INITIAL_MEETINGS, INITIAL_TASKS, INITIAL_LOGS } from '../src/data/initialData';

export const DEFAULT_PASSWORD = 'nitc123';

/**
 * Seed dữ liệu mẫu khi CSDL trống (lần chạy đầu) — tái tạo đúng bộ demo của MVP,
 * kèm tạo tài khoản đăng nhập cho từng thành viên (mật khẩu mặc định DEFAULT_PASSWORD).
 */
export async function seedIfEmpty(): Promise<boolean> {
  const memberCount = await prisma.member.count();
  if (memberCount > 0) return false;

  await seedDemoData();
  return true;
}

/** Wipe + seed lại (dùng cho "Reset Demo" của Chủ tịch) */
export async function resetAndSeed(): Promise<void> {
  await prisma.$transaction([
    prisma.user.deleteMany(),
    prisma.task.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.notificationLog.deleteMany(),
    prisma.member.deleteMany(),
  ]);
  await seedDemoData();
}

async function seedDemoData(): Promise<void> {
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  // 1. Members + Users
  for (const m of INITIAL_MEMBERS) {
    await prisma.member.create({
      data: {
        id: m.id,
        name: m.name,
        role: m.role,
        department: m.department,
        email: m.email,
        phone: m.phone ?? null,
      },
    });
    await prisma.user.create({
      data: { email: m.email.toLowerCase(), passwordHash, memberId: m.id },
    });
  }

  // 2. Meetings
  for (const mt of INITIAL_MEETINGS) {
    await prisma.meeting.create({
      data: {
        id: mt.id,
        title: mt.title,
        date: mt.date,
        chairperson: mt.chairperson,
        secretary: mt.secretary,
        attendees: JSON.stringify(mt.attendees),
        absentees: JSON.stringify(mt.absentees),
        discussionSummary: mt.discussionSummary,
        actionPlan: mt.actionPlan,
        rawContent: mt.rawContent,
        createdAt: mt.createdAt ? new Date(mt.createdAt) : new Date(),
      },
    });
  }

  // 3. Tasks
  for (const t of INITIAL_TASKS) {
    await prisma.task.create({
      data: {
        id: t.id,
        title: t.title,
        description: t.description ?? null,
        assigneeId: t.assigneeId,
        assigneeName: t.assigneeName,
        department: t.department,
        deadline: t.deadline,
        status: t.status,
        verificationType: t.verificationType,
        evidenceLink: t.evidenceLink ?? null,
        evidenceReport: t.evidenceReport ?? null,
        evidenceSubmittedAt: t.evidenceSubmittedAt ?? null,
        approvalNote: t.approvalNote ?? null,
        rejectedReason: t.rejectedReason ?? null,
        sourceMeetingId: t.sourceMeetingId ?? null,
        priority: t.priority ?? null,
        isSticky: t.isSticky ?? false,
        stickyWeeksCount: t.stickyWeeksCount ?? null,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
      },
    });
  }

  // 4. Logs
  for (const lg of INITIAL_LOGS) {
    await prisma.notificationLog.create({
      data: {
        id: lg.id,
        type: lg.type,
        recipientName: lg.recipientName,
        recipientEmail: lg.recipientEmail,
        department: lg.department ?? null,
        subject: lg.subject,
        content: lg.content,
        sentAt: lg.sentAt ? new Date(lg.sentAt) : new Date(),
        status: lg.status,
        taskCount: lg.taskCount ?? null,
      },
    });
  }
}
