import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { hashPassword } from './auth';
import { config } from './config';
import { INITIAL_MEMBERS, INITIAL_MEETINGS, INITIAL_TASKS, INITIAL_LOGS } from '../src/data/initialData';

export const DEFAULT_PASSWORD = config.defaultPassword;

/**
 * Seed dữ liệu mẫu khi CSDL trống (lần chạy đầu) — tái tạo đúng bộ demo của MVP,
 * kèm tạo tài khoản đăng nhập cho từng thành viên (mật khẩu mặc định DEFAULT_PASSWORD).
 */
export async function seedIfEmpty(): Promise<boolean> {
  const memberCount = await prisma.member.count();
  if (memberCount > 0) return false;

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  await prisma.$transaction((tx) => seedDemoData(tx, passwordHash), { timeout: 120_000, maxWait: 15_000 });
  return true;
}

/**
 * Wipe + seed lại (dùng cho "Reset Demo" của Chủ nhiệm).
 * Xóa và ghi lại trong MỘT transaction: lỗi giữa chừng thì dữ liệu cũ còn nguyên.
 */
export async function resetAndSeed(): Promise<void> {
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  await prisma.$transaction(
    async (tx) => {
      await tx.user.deleteMany();
      await tx.task.deleteMany();
      await tx.meeting.deleteMany();
      await tx.notificationLog.deleteMany();
      await tx.member.deleteMany();
      await seedDemoData(tx, passwordHash);
    },
    { timeout: 120_000, maxWait: 15_000 }
  );
}

/** Nhiệm kỳ hiện hành; chưa có thì tạo theo năm học hiện tại (từ tháng 8 tính sang năm học mới). */
async function ensureActiveTerm(tx: Prisma.TransactionClient): Promise<{ id: string }> {
  const active = await tx.term.findFirst({ where: { isActive: true } });
  if (active) return active;
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const name = `${startYear}-${startYear + 1}`;
  return tx.term.upsert({ where: { name }, update: { isActive: true }, create: { name, isActive: true } });
}

async function seedDemoData(tx: Prisma.TransactionClient, passwordHash: string): Promise<void> {
  // Gắn thành viên vào nhiệm kỳ hiện hành — GET /members mặc định lọc theo nhiệm kỳ này,
  // thiếu termId thì danh bạ hiện rỗng dù dữ liệu vẫn có.
  const term = await ensureActiveTerm(tx);

  // 1. Members + Users
  for (const m of INITIAL_MEMBERS) {
    await tx.member.create({
      data: {
        id: m.id,
        name: m.name,
        role: m.role,
        department: m.department,
        email: m.email.toLowerCase(),
        phone: m.phone ?? null,
        studentId: m.studentId ?? null,
        className: m.className ?? null,
        termId: term.id,
      },
    });
    await tx.user.create({
      data: { email: m.email.toLowerCase(), passwordHash, memberId: m.id },
    });
  }

  // 2. Meetings
  for (const mt of INITIAL_MEETINGS) {
    await tx.meeting.create({
      data: {
        id: mt.id,
        termId: term.id,
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
    await tx.task.create({
      data: {
        id: t.id,
        termId: term.id,
        title: t.title,
        description: t.description ?? null,
        assigneeId: t.assigneeId,
        assigneeName: t.assigneeName,
        assigneeIds: JSON.stringify(t.assigneeIds && t.assigneeIds.length > 0 ? t.assigneeIds : [t.assigneeId]),
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
    await tx.notificationLog.create({
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
