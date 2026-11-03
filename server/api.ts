import { Request, Response, Router } from 'express';
import multer from 'multer';
import { prisma } from './db';
import {
  requireAuth,
  requirePresident,
  requirePresidentOrHead,
  isPresident,
  isLeadership,
  canManageDepartment,
  canViewTask,
  hashPassword,
} from './auth';
import { serializeTask, serializeMeeting, serializeMember, serializeLog } from './serialize';
import { resetAndSeed, DEFAULT_PASSWORD } from './seed';
import { importRosterFromExcel, getActiveTerm } from './importExcel';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const apiRouter: Router = Router();

// Lưu ý: mọi route dưới đây đều cần đăng nhập (mounted sau requireAuth trong server.ts)

// ============ TERMS (Nhiệm kỳ) ============

apiRouter.get('/terms', async (_req: Request, res: Response) => {
  const terms = await prisma.term.findMany({
    orderBy: { name: 'desc' },
    include: { _count: { select: { members: true } } },
  });
  res.json(
    terms.map((t) => ({
      id: t.id,
      name: t.name,
      isActive: t.isActive,
      memberCount: t._count.members,
    }))
  );
});

apiRouter.post('/terms', requirePresident, async (req: Request, res: Response) => {
  const { name } = req.body || {};
  if (!name || !/^\d{4}-\d{4}$/.test(String(name).trim())) {
    return res.status(400).json({ error: 'Tên nhiệm kỳ phải theo định dạng YYYY-YYYY (VD: 2026-2027)' });
  }
  const term = await prisma.term.upsert({
    where: { name: String(name).trim() },
    update: {},
    create: { name: String(name).trim() },
  });
  return res.status(201).json(term);
});

apiRouter.put('/terms/:id/activate', requirePresident, async (req: Request, res: Response) => {
  const { id } = req.params;
  const term = await prisma.term.findUnique({ where: { id } });
  if (!term) return res.status(404).json({ error: 'Không tìm thấy nhiệm kỳ' });
  await prisma.$transaction([
    prisma.term.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.term.update({ where: { id }, data: { isActive: true } }),
  ]);
  return res.json({ success: true, activeTerm: term.name });
});

// ============ MEMBERS (Danh bạ) ============

// Mặc định trả về thành viên nhiệm kỳ hiện hành; ?all=1 để lấy tất cả; ?termId= để lọc
apiRouter.get('/members', async (req: Request, res: Response) => {
  const { termId, all } = req.query;
  const where: Record<string, unknown> = {};
  if (termId) {
    where.termId = String(termId);
  } else if (!all) {
    const activeTerm = await prisma.term.findFirst({ where: { isActive: true } });
    where.termId = activeTerm ? activeTerm.id : undefined;
  }
  const members = await prisma.member.findMany({
    where,
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json(members.map(serializeMember));
});

/**
 * POST /members/import — Import file Excel danh bạ (multipart/form-data: file + termName).
 * Mỗi sheet = 1 ban; upsert theo email; nhiệm kỳ mới được đặt làm hiện hành.
 */
apiRouter.post('/members/import', requirePresident, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng đính kèm file Excel (.xlsx)' });
  }
  const termName = String(req.body?.termName || '').trim();
  if (!termName) {
    return res.status(400).json({ error: 'Vui lòng nhập tên nhiệm kỳ (VD: 2025-2026)' });
  }
  try {
    const summary = await importRosterFromExcel(req.file.buffer, termName);
    return res.json({ success: true, summary });
  } catch (e: any) {
    console.error('Excel import error:', e);
    return res.status(400).json({ error: 'Không đọc được file Excel. Kiểm tra lại định dạng danh bạ NITC.' });
  }
});

apiRouter.post('/members', requirePresident, async (req: Request, res: Response) => {
  const { id, name, role, department, email, phone, studentId, className } = req.body || {};
  if (!name || !role || !department || !email) {
    return res.status(400).json({ error: 'Thiếu thông tin thành viên (tên, vai trò, ban, email)' });
  }
  const dup = await prisma.member.findFirst({ where: { email } });
  if (dup) return res.status(409).json({ error: `Email ${email} đã có trong danh bạ` });

  const activeTerm = await getActiveTerm();
  const member = await prisma.member.create({
    data: {
      id: id || undefined,
      name, role, department, email,
      phone: phone || null,
      studentId: studentId || null,
      className: className || null,
      termId: activeTerm.id,
    },
  });
  // Tạo tài khoản đăng nhập kèm theo (mật khẩu mặc định)
  await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash: await hashPassword(DEFAULT_PASSWORD), memberId: member.id },
  });
  return res.status(201).json(serializeMember(member));
});

apiRouter.put('/members/:id', requirePresident, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, role, department, email, phone, status, studentId, className, birthday } = req.body || {};
  const existing = await prisma.member.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy thành viên' });

  const member = await prisma.member.update({
    where: { id },
    data: {
      name: name ?? undefined,
      role: role ?? undefined,
      department: department ?? undefined,
      email: email ?? undefined,
      phone: phone !== undefined ? phone || null : undefined,
      studentId: studentId !== undefined ? studentId || null : undefined,
      className: className !== undefined ? className || null : undefined,
      birthday: birthday !== undefined ? birthday || null : undefined,
      status: status ?? undefined,
    },
  });
  // Đồng bộ email tài khoản đăng nhập nếu đổi email
  if (email && email !== existing.email) {
    await prisma.user.updateMany({ where: { memberId: id }, data: { email: email.toLowerCase() } });
  }
  return res.json(serializeMember(member));
});

apiRouter.delete('/members/:id', requirePresident, async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.member.findUnique({ where: { id }, include: { tasks: { select: { id: true } } } });
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy thành viên' });
  if (existing.role === 'Chủ tịch') {
    return res.status(403).json({ error: 'Không thể xóa Chủ tịch CLB' });
  }
  if (existing.tasks.length > 0) {
    return res.status(409).json({
      error: `Thành viên đang phụ trách ${existing.tasks.length} nhiệm vụ. Chuyển/hoàn thành việc trước khi xóa.`,
    });
  }
  await prisma.member.delete({ where: { id } }); // User bị xóa cascade
  return res.json({ success: true });
});

// ============ TASKS (Nhiệm vụ) ============

apiRouter.get('/tasks', async (req: Request, res: Response) => {
  const me = req.authMember!;
  const tasks = await prisma.task.findMany({
    include: { sourceMeeting: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const visible = isPresident(me) ? tasks : tasks.filter((t) => canViewTask(me, t));
  res.json(visible.map(serializeTask));
});

function validateTaskInput(b: any): string | null {
  if (!b.title) return 'Thiếu tiêu đề nhiệm vụ';
  if (!b.department) return 'Thiếu ban phụ trách';
  if (!b.deadline) return 'Thiếu hạn chót';
  if (!b.assigneeId) return 'Thiếu người phụ trách';
  return null;
}

apiRouter.post('/tasks', requirePresidentOrHead, async (req: Request, res: Response) => {
  const me = req.authMember!;
  const b = req.body || {};
  const err = validateTaskInput(b);
  if (err) return res.status(400).json({ error: err });

  // Trưởng ban/Phó ban chỉ giao việc trong phạm vi ban mình
  if (!canManageDepartment(me, b.department)) {
    return res.status(403).json({ error: 'Chỉ được giao việc cho ban của bạn' });
  }
  const assignee = await prisma.member.findUnique({ where: { id: b.assigneeId } });
  if (!assignee) return res.status(400).json({ error: 'Người phụ trách không tồn tại trong danh bạ' });

  const task = await prisma.task.create({
    data: {
      title: b.title,
      description: b.description || null,
      assigneeId: b.assigneeId,
      assigneeName: assignee.name,
      department: b.department,
      deadline: b.deadline,
      status: b.status || 'in_progress',
      verificationType: b.verificationType || 'link_required',
      priority: b.priority || 'medium',
      isSticky: b.isSticky ?? false,
      sourceMeetingId: b.sourceMeetingId || null,
      createdById: me.id,
    },
    include: { sourceMeeting: { select: { id: true, title: true } } },
  });
  return res.status(201).json(serializeTask(task));
});

/**
 * PUT /tasks/:id — hành động tường minh theo `action`:
 *  - submit_evidence: người được giao / cùng ban / Chủ tịch
 *  - approve / reject: Chủ tịch
 *  - update: sửa thông tin (Chủ tịch, hoặc Trưởng/Phó ban trong ban mình)
 */
apiRouter.put('/tasks/:id', requireAuth, async (req: Request, res: Response) => {
  const me = req.authMember!;
  const { id } = req.params;
  const { action } = req.body || {};

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: 'Không tìm thấy nhiệm vụ' });
  if (!canViewTask(me, task)) return res.status(403).json({ error: 'Bạn không có quyền với nhiệm vụ này' });

  const now = new Date();

  if (action === 'submit_evidence') {
    const canSubmit = isPresident(me) || me.department === task.department || me.id === task.assigneeId;
    if (!canSubmit) return res.status(403).json({ error: 'Chỉ người được giao / cùng ban / Chủ tịch được nộp minh chứng' });
    const link = req.body.link || null;
    const report = req.body.report || null;
    if (task.verificationType === 'link_required' && !link) {
      return res.status(400).json({ error: 'Nhiệm vụ này yêu cầu link sản phẩm' });
    }
    if (task.verificationType === 'report_required' && !report) {
      return res.status(400).json({ error: 'Nhiệm vụ này yêu cầu báo cáo 2 câu' });
    }
    const updated = await prisma.task.update({
      where: { id },
      data: {
        evidenceLink: link ?? task.evidenceLink,
        evidenceReport: report ?? task.evidenceReport,
        evidenceSubmittedAt: now.toISOString(),
        status: 'pending_approval',
        updatedAt: now,
      },
      include: { sourceMeeting: { select: { id: true, title: true } } },
    });
    return res.json(serializeTask(updated));
  }

  if (action === 'approve') {
    if (!isLeadership(me)) return res.status(403).json({ error: 'Chỉ Ban lãnh đạo (Chủ tịch/Phó Chủ tịch) được duyệt minh chứng' });
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: 'completed',
        approvalNote: req.body.note || 'Chủ tịch đã duyệt hoàn thành.',
        rejectedReason: null,
        updatedAt: now,
      },
      include: { sourceMeeting: { select: { id: true, title: true } } },
    });
    return res.json(serializeTask(updated));
  }

  if (action === 'reject') {
    if (!isLeadership(me)) return res.status(403).json({ error: 'Chỉ Ban lãnh đạo được trả lại minh chứng' });
    const reason = req.body.reason;
    if (!reason) return res.status(400).json({ error: 'Bắt buộc nhập lý do trả lại' });
    const updated = await prisma.task.update({
      where: { id },
      data: { status: 'in_progress', rejectedReason: reason, updatedAt: now },
      include: { sourceMeeting: { select: { id: true, title: true } } },
    });
    return res.json(serializeTask(updated));
  }

  if (action === 'update') {
    const b = req.body;
    // Đổi ban phụ trách -> kiểm tra quyền quản lý cả ban cũ lẫn ban mới
    const newDept = b.department ?? task.department;
    if (!canManageDepartment(me, newDept) || !canManageDepartment(me, task.department)) {
      return res.status(403).json({ error: 'Không có quyền sửa nhiệm vụ này' });
    }
    let assigneeName = task.assigneeName;
    if (b.assigneeId && b.assigneeId !== task.assigneeId) {
      const assignee = await prisma.member.findUnique({ where: { id: b.assigneeId } });
      if (!assignee) return res.status(400).json({ error: 'Người phụ trách không tồn tại' });
      assigneeName = assignee.name;
    }
    const updated = await prisma.task.update({
      where: { id },
      data: {
        title: b.title ?? undefined,
        description: b.description !== undefined ? b.description || null : undefined,
        assigneeId: b.assigneeId ?? undefined,
        assigneeName,
        department: b.department ?? undefined,
        deadline: b.deadline ?? undefined,
        priority: b.priority ?? undefined,
        verificationType: b.verificationType ?? undefined,
        isSticky: b.isSticky ?? undefined,
        updatedAt: now,
      },
      include: { sourceMeeting: { select: { id: true, title: true } } },
    });
    return res.json(serializeTask(updated));
  }

  return res.status(400).json({ error: 'Action không hợp lệ (submit_evidence | approve | reject | update)' });
});

apiRouter.delete('/tasks/:id', requirePresident, async (req: Request, res: Response) => {
  const { id } = req.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: 'Không tìm thấy nhiệm vụ' });
  await prisma.task.delete({ where: { id } });
  return res.json({ success: true });
});

// ============ MEETINGS (Kho BBH) ============

apiRouter.get('/meetings', async (req: Request, res: Response) => {
  const meetings = await prisma.meeting.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(meetings.map(serializeMeeting));
});

/**
 * POST /meetings/publish — Ban hành kỳ họp + bộ nhiệm vụ (Presidential Filter → Bảng điều hành).
 * Áp dụng Quy tắc Sticky: mọi việc chưa hoàn thành từ kỳ trước bị đánh dấu lưu chuyển.
 */
apiRouter.post('/meetings/publish', requirePresidentOrHead, async (req: Request, res: Response) => {
  if (!isLeadership(req.authMember)) return res.status(403).json({ error: 'Chỉ Ban lãnh đạo được ban hành kỳ họp' });
  const me = req.authMember!;
  const { meeting, tasks } = req.body || {};
  if (!meeting?.title || !meeting?.date) {
    return res.status(400).json({ error: 'Thiếu thông tin kỳ họp' });
  }
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'Không có nhiệm vụ nào để ban hành' });
  }

  const created = await prisma.$transaction(async (tx) => {
    const m = await tx.meeting.create({
      data: {
        id: meeting.id || undefined,
        title: meeting.title,
        date: meeting.date,
        time: meeting.time || null,
        location: meeting.location || null,
        chairperson: meeting.chairperson || me.name,
        secretary: meeting.secretary || '',
        attendees: JSON.stringify(meeting.attendees || []),
        absentees: JSON.stringify(meeting.absentees || []),
        discussionSummary: meeting.discussionSummary || '',
        actionPlan: meeting.actionPlan || '',
        rawContent: meeting.rawContent || '',
      },
    });

    // Sticky: việc chưa xong từ các kỳ trước → lưu chuyển
    await tx.task.updateMany({
      where: { status: { not: 'completed' } },
      data: { isSticky: true },
    });

    const newTasks = [];
    for (const t of tasks) {
      const assignee = t.suggestedAssigneeId
        ? await tx.member.findUnique({ where: { id: t.suggestedAssigneeId } })
        : null;
      const task = await tx.task.create({
        data: {
          title: t.title,
          assigneeId: t.suggestedAssigneeId || 'mem-1',
          assigneeName: assignee?.name || t.suggestedAssigneeName || t.rawAssigneeText || 'Chưa gán',
          department: t.suggestedDepartment,
          deadline: t.suggestedDeadline,
          status: 'in_progress',
          verificationType: t.verificationType || 'link_required',
          priority: t.priority || 'medium',
          isSticky: false,
          sourceMeetingId: m.id,
          createdById: me.id,
        },
        include: { sourceMeeting: { select: { id: true, title: true } } },
      });
      newTasks.push(serializeTask(task));
    }
    return { meeting: serializeMeeting(m), tasks: newTasks };
  });

  return res.status(201).json(created);
});

// ============ LOGS (Nhật ký Nag) ============

apiRouter.get('/logs', requirePresidentOrHead, async (req: Request, res: Response) => {
  if (!isLeadership(req.authMember)) return res.status(403).json({ error: 'Chỉ Ban lãnh đạo được xem nhật ký' });
  const logs = await prisma.notificationLog.findMany({ orderBy: { sentAt: 'desc' }, take: 100 });
  res.json(logs.map(serializeLog));
});

apiRouter.post('/logs', requirePresidentOrHead, async (req: Request, res: Response) => {
  const b = req.body || {};
  if (!b.subject || !b.recipientEmail) {
    return res.status(400).json({ error: 'Thiếu người nhận hoặc tiêu đề' });
  }
  const log = await prisma.notificationLog.create({
    data: {
      type: b.type || 'overdue_nag',
      recipientName: b.recipientName || 'Ban Điều Hành NITC',
      recipientEmail: b.recipientEmail,
      department: b.department || null,
      subject: b.subject,
      content: b.content || '',
      status: 'sent',
      taskCount: b.taskCount ?? 1,
    },
  });
  return res.status(201).json(serializeLog(log));
});

// ============ ADMIN (Import / Reset) ============

apiRouter.post('/admin/import', requirePresident, async (req: Request, res: Response) => {
  const { tasks, meetings, members, logs } = req.body || {};
  if (!Array.isArray(members) || !Array.isArray(tasks) || !Array.isArray(meetings)) {
    return res.status(400).json({ error: 'Dữ liệu import cần có members, tasks, meetings' });
  }

  await prisma.$transaction([
    prisma.user.deleteMany(),
    prisma.task.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.notificationLog.deleteMany(),
    prisma.member.deleteMany(),
  ]);

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  for (const m of members) {
    await prisma.member.create({
      data: {
        id: m.id, name: m.name, role: m.role, department: m.department,
        email: m.email, phone: m.phone || null,
      },
    });
    await prisma.user.create({
      data: { email: String(m.email).toLowerCase(), passwordHash, memberId: m.id },
    });
  }
  for (const mt of meetings) {
    await prisma.meeting.create({
      data: {
        id: mt.id, title: mt.title, date: mt.date,
        chairperson: mt.chairperson || '', secretary: mt.secretary || '',
        attendees: JSON.stringify(mt.attendees || []),
        absentees: JSON.stringify(mt.absentees || []),
        discussionSummary: mt.discussionSummary || '',
        actionPlan: mt.actionPlan || '',
        rawContent: mt.rawContent || '',
        createdAt: mt.createdAt ? new Date(mt.createdAt) : new Date(),
      },
    });
  }
  for (const t of tasks) {
    await prisma.task.create({
      data: {
        id: t.id, title: t.title, description: t.description || null,
        assigneeId: t.assigneeId, assigneeName: t.assigneeName, department: t.department,
        deadline: t.deadline, status: t.status, verificationType: t.verificationType,
        evidenceLink: t.evidenceLink || null, evidenceReport: t.evidenceReport || null,
        evidenceSubmittedAt: t.evidenceSubmittedAt || null,
        approvalNote: t.approvalNote || null, rejectedReason: t.rejectedReason || null,
        sourceMeetingId: t.sourceMeetingId || null, priority: t.priority || null,
        isSticky: t.isSticky || false, stickyWeeksCount: t.stickyWeeksCount || null,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
      },
    });
  }
  for (const lg of logs || []) {
    await prisma.notificationLog.create({
      data: {
        id: lg.id, type: lg.type || 'overdue_nag',
        recipientName: lg.recipientName || '', recipientEmail: lg.recipientEmail || '',
        department: lg.department || null, subject: lg.subject || '', content: lg.content || '',
        sentAt: lg.sentAt ? new Date(lg.sentAt) : new Date(),
        status: lg.status || 'sent', taskCount: lg.taskCount ?? null,
      },
    });
  }

  return res.json({ success: true, imported: { members: members.length, meetings: meetings.length, tasks: tasks.length, logs: (logs || []).length } });
});

apiRouter.post('/admin/reset', requirePresident, async (req: Request, res: Response) => {
  await resetAndSeed();
  return res.json({ success: true });
});
