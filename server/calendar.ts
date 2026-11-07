import { Request, Response } from 'express';
import { prisma } from './db';

// ===== G5: Xuất lịch ICS (Google Calendar / Apple Calendar) =====
// GET /api/calendar.ics?token=JWT — deadline công việc (all-day) + các kỳ họp

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function ymdCompact(ymd: string): string {
  return ymd.replace(/-/g, '');
}

export async function calendarIcsHandler(req: Request, res: Response) {
  const me = req.authMember!;
  const today = new Date().toISOString().split('T')[0];
  const stamp = today.replace(/-/g, '') + 'T000000Z';

  const isLeadershipUser = me.role === 'Chủ nhiệm' || me.role === 'Phó Chủ nhiệm';

  // Phạm vi dữ liệu giống GET /tasks + /meetings (không phải lãnh đạo chỉ thấy ban mình)
  const tasks = await prisma.task.findMany({ include: { sourceMeeting: true } });
  const meetings = await prisma.meeting.findMany();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NITC Command Center//Lich dieu hanh//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:NITC Command Center — ${me.department}`,
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
  ];

  let eventCount = 0;
  for (const t of tasks) {
    // Quyền xem: lãnh đạo tất cả; người khác: ban mình + việc giao mình + việc nhóm có mình
    let ids: string[] = [t.assigneeId];
    try {
      const p = JSON.parse(t.assigneeIds);
      if (Array.isArray(p) && p.length) ids = p;
    } catch {}
    const canView =
      isLeadershipUser || t.department === me.department || ids.includes(me.id);
    if (!canView) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.deadline)) continue;

    const status = t.status === 'completed' ? '✅ ĐÃ XONG' : t.deadline < today ? '🚨 QUÁ HẠN' : '📌 ĐANG LÀM';
    lines.push(
      'BEGIN:VEVENT',
      `UID:task-${t.id}@nitc-command-center`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymdCompact(t.deadline)}`,
      `DTEND;VALUE=DATE:${ymdCompact(t.deadline)}`,
      `SUMMARY:${icsEscape(`[${status}] [${t.department}] ${t.title}`)}`,
      `DESCRIPTION:${icsEscape(
        `Người phụ trách: ${t.assigneeName}${ids.length > 1 ? ` (+${ids.length - 1} người)` : ''}\n` +
          `Loại xác minh: ${t.verificationType === 'link_required' ? 'Cần link sản phẩm' : 'Báo cáo 2 câu'}\n` +
          (t.sourceMeeting ? `Nguồn: ${t.sourceMeeting.title}` : '')
      )}`,
      'CATEGORIES:NITC_TASK',
      'END:VEVENT'
    );
    eventCount++;
  }

  for (const m of meetings) {
    const canView = isLeadershipUser || m.department === 'Ban Chủ nhiệm' || m.department === me.department;
    if (!canView) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:meeting-${m.id}@nitc-command-center`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymdCompact(m.date)}`,
      `DTEND;VALUE=DATE:${ymdCompact(m.date)}`,
      `SUMMARY:${icsEscape(`🤝 Họp: ${m.title}`)}`,
      `DESCRIPTION:${icsEscape(
        `Chủ trì: ${m.chairperson}\nThư ký: ${m.secretary}\n` +
          (m.location ? `Địa điểm: ${m.location}\n` : '') +
          (m.time ? `Giờ: ${m.time}` : '')
      )}`,
      'CATEGORIES:NITC_MEETING',
      'END:VEVENT'
    );
    eventCount++;
  }

  lines.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="nitc-lich-dieu-hanh-${today}.ics"`
  );
  res.send(lines.join('\r\n') + '\r\n');
  void eventCount;
}
