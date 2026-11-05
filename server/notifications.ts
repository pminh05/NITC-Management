import { Prisma } from '@prisma/client';
import { prisma } from './db';

// ===== Trung tâm thông báo (G2) =====
// Sinh thông báo cá nhân đúng người — gắn vào mọi sự kiện nghiệp vụ + cron quét deadline.

export type NotifyType =
  | 'task_assigned'
  | 'deadline_tomorrow'
  | 'deadline_today'
  | 'overdue'
  | 'evidence_submitted'
  | 'evidence_approved'
  | 'evidence_rejected'
  | 'sticky_carried'
  | 'weekly_summary'
  | 'broadcast';

export interface NotifyInput {
  memberId: string;
  type: NotifyType;
  title: string;
  body?: string;
  taskId?: string;
  dedupeKey?: string;
}

// Emitter nhẹ cho SSE — mỗi memberId một tập listener
const listeners = new Map<string, Set<(payload: string) => void>>();

export function subscribeMember(memberId: string, fn: (payload: string) => void): () => void {
  if (!listeners.has(memberId)) listeners.set(memberId, new Set());
  listeners.get(memberId)!.add(fn);
  return () => {
    listeners.get(memberId)?.delete(fn);
    if (listeners.get(memberId)?.size === 0) listeners.delete(memberId);
  };
}

function emitToMember(memberId: string, payload: unknown): void {
  const set = listeners.get(memberId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const fn of set) {
    try {
      fn(data);
    } catch {
      // listener chết — bỏ qua, polling fallback sẽ bắt kịp
    }
  }
}

/** Gửi email qua SMTP nếu bật EMAIL_ENABLED — trả về true nếu đã gửi */
export async function sendEmailIfEnabled(to: string, subject: string, text: string): Promise<boolean> {
  if (process.env.EMAIL_ENABLED !== 'true') return false;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `NITC Command Center <${user}>`,
      to,
      subject,
      text,
    });
    return true;
  } catch (e) {
    console.error('Email send failed:', e);
    return false;
  }
}

/**
 * Tạo 1 thông báo (đã chống trùng bằng dedupeKey), đẩy SSE tới người nhận,
 * và gửi email kèm theo nếu thành viên chọn nhận email ngay.
 */
export async function notify(input: NotifyInput): Promise<void> {
  // Chống trùng: cùng dedupeKey → bỏ qua lặng lẽ
  if (input.dedupeKey) {
    const exists = await prisma.notification.findUnique({ where: { dedupeKey: input.dedupeKey } });
    if (exists) return;
  }

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    include: { notificationPref: true },
  });
  if (!member || member.status !== 'active') return;

  const created = await prisma.notification.create({
    data: {
      memberId: input.memberId,
      type: input.type,
      title: input.title,
      body: input.body,
      taskId: input.taskId,
      dedupeKey: input.dedupeKey,
    },
  });

  emitToMember(input.memberId, {
    id: created.id,
    type: created.type,
    title: created.title,
    body: created.body,
    taskId: created.taskId,
    createdAt: created.createdAt.toISOString(),
  });

  const channel = member.notificationPref?.channel || 'in_app';
  if (channel === 'in_app_email' && member.email) {
    await sendEmailIfEnabled(member.email, `[NITC] ${created.title}`, created.body || '');
  }
}

/** Gửi thông báo cho cả Ban lãnh đạo (Chủ nhiệm + Phó Chủ nhiệm) */
export async function notifyLeadership(input: Omit<NotifyInput, 'memberId'>): Promise<void> {
  const leaders = await prisma.member.findMany({
    where: { role: { in: ['Chủ nhiệm', 'Phó Chủ nhiệm'] }, status: 'active' },
  });
  for (const leader of leaders) {
    await notify({ ...input, memberId: leader.id, dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${leader.id}` : undefined });
  }
}

/** Trưởng ban của 1 ban (nếu có) */
export async function departmentHead(department: string): Promise<{ id: string; email: string; name: string } | null> {
  const head = await prisma.member.findFirst({
    where: { department, role: 'Trưởng ban', status: 'active' },
  });
  return head ? { id: head.id, email: head.email, name: head.name } : null;
}

// ===== Queries cho API =====

export async function listNotifications(memberId: string, opts: { unreadOnly?: boolean; take?: number } = {}) {
  const where: Prisma.NotificationWhereInput = { memberId };
  if (opts.unreadOnly) where.readAt = null;
  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 30,
  });
}

export async function unreadCount(memberId: string): Promise<number> {
  return prisma.notification.count({ where: { memberId, readAt: null } });
}

export async function markRead(memberId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, memberId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(memberId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { memberId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function getPref(memberId: string): Promise<string> {
  const pref = await prisma.notificationPref.findUnique({ where: { memberId } });
  return pref?.channel || 'in_app';
}

export async function setPref(memberId: string, channel: string): Promise<void> {
  const valid = ['in_app', 'in_app_email', 'digest'];
  if (!valid.includes(channel)) {
    throw new Error(`Kênh không hợp lệ (${valid.join(' | ')})`);
  }
  await prisma.notificationPref.upsert({
    where: { memberId },
    update: { channel },
    create: { memberId, channel },
  });
}
