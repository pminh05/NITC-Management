import { NextFunction, Request, Response, Router } from 'express';
import path from 'path';
import multer from 'multer';
import { prisma } from './db';
import { requireAuth, hashPassword } from './auth';
import {
  DEPT_MANAGER_ROLES,
  LEADERSHIP_ROLES,
  assertCan,
  canCreateTask,
  canCreateTaskIn,
  canDeleteMember,
  canDeleteTask,
  canDestructiveAdmin,
  canEditMember,
  canEditTask,
  canManageRoster,
  canManageSettings,
  canManageTerms,
  canPublishMeeting,
  canRemindTask,
  canResetMemberPassword,
  canReviewTask,
  canScanDeadlines,
  canSubmitEvidence,
  canViewLogs,
  canViewMeeting,
  canViewTask,
  canWriteLogs,
  logDepartmentScope,
  isLeadership,
  isPresident,
  taskAssigneeIds,
  requireCan,
  serializeMemberFor,
} from './permissions';
import { serializeTask, serializeMeeting, serializeMember, serializeLog } from './serialize';
import { resetAndSeed, DEFAULT_PASSWORD } from './seed';
import { importRosterFromExcel, getActiveTerm } from './importExcel';
import {
  notify,
  notifyLeadership,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  getPref,
  setPref,
} from './notifications';
import { scanDeadlines, rescheduleWeeklyReport } from './scheduler';
import { getSettings, updateSettings, AppSettings } from './settings';
import { computeKpi } from './kpi';
import { config } from './config';
import { HttpError, asyncRouter, validate } from './http';
import { backupDatabase } from './backup';
import { todayVN } from '../shared/time';
import { COMPLETED_EDITABLE_FIELDS, effectiveStatus, transitionError } from '../shared/taskState';
import {
  adminImportSchema,
  logCreateSchema,
  memberCreateSchema,
  memberUpdateSchema,
  publishSchema,
  remindSchema,
  taskActionSchema,
  taskCreateSchema,
} from './schemas';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// asyncRouter: mọi handler async được bọc sẵn — lỗi/reject đi về errorHandler thay vì làm sập server
export const apiRouter: Router = asyncRouter();

// Lưu ý: mọi route dưới đây đều cần đăng nhập (mounted sau requireAuth trong server.ts)
// và mọi req.body đều phải đi qua validate(schema, ...) trước khi chạm CSDL.
// Quyền: KHÔNG so sánh vai trò trực tiếp ở đây — chỉ gọi các hàm can*() của shared/permissions.ts.

const ONLY_PRESIDENT = 'Chỉ Chủ nhiệm mới được thực hiện thao tác này';
const ONLY_MANAGERS = 'Chỉ Ban lãnh đạo hoặc Trưởng ban/Phó ban được thao tác này';
const ONLY_LEADERSHIP = 'Chỉ Ban lãnh đạo (Chủ nhiệm/Phó Chủ nhiệm) được thao tác này';
const REVIEW_DENIED =
  'Chỉ Ban lãnh đạo hoặc Trưởng ban/Phó ban của ban này được duyệt minh chứng (và không tự duyệt việc của chính mình)';

/** Báo cho những người có quyền duyệt việc này: Ban lãnh đạo + Trưởng/Phó ban của ban đó (trừ chính người được giao). */
async function notifyReviewers(
  task: { id: string; department: string; assigneeId: string; assigneeIds: string },
  input: { type: Parameters<typeof notify>[0]['type']; title: string; body: string; dedupeKey: string },
  exceptMemberId?: string
): Promise<void> {
  const candidates = await prisma.member.findMany({
    where: {
      status: 'active',
      OR: [{ role: { in: LEADERSHIP_ROLES } }, { role: { in: DEPT_MANAGER_ROLES }, department: task.department }],
    },
  });
  for (const c of candidates) {
    if (c.id === exceptMemberId || !canReviewTask(c, task)) continue;
    await notify({ ...input, memberId: c.id, taskId: task.id, dedupeKey: `${input.dedupeKey}:${c.id}` });
  }
}

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

apiRouter.post('/terms', requireCan(canManageTerms, ONLY_PRESIDENT), async (req: Request, res: Response) => {
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

apiRouter.put('/terms/:id/activate', requireCan(canManageTerms, ONLY_PRESIDENT), async (req: Request, res: Response) => {
  const { id } = req.params;
  const term = await prisma.term.findUnique({ where: { id } });
  if (!term) return res.status(404).json({ error: 'Không tìm thấy nhiệm kỳ' });
  await prisma.$transaction([
    prisma.term.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.term.update({ where: { id }, data: { isActive: true } }),
  ]);
  return res.json({ success: true, activeTerm: term.name });
});

// ============ SETTINGS (Cấu hình) ============

apiRouter.get('/settings', async (_req: Request, res: Response) => {
  res.json(await getSettings());
});

apiRouter.put('/settings', requireCan(canManageSettings, ONLY_PRESIDENT), async (req: Request, res: Response) => {
  const b = req.body || {};
  const partial: Partial<AppSettings> = {};
  if (typeof b.clubName === 'string' && b.clubName.trim()) partial.clubName = b.clubName.trim();
  if (typeof b.groupEmail === 'string' && b.groupEmail.includes('@')) partial.groupEmail = b.groupEmail.trim();
  for (const k of ['kpiOnTime', 'kpiLate', 'kpiPending', 'kpiOverdue'] as const) {
    if (typeof b[k] === 'number' && Number.isFinite(b[k])) partial[k] = Math.round(b[k]);
  }
  if (typeof b.reportDayOfWeek === 'number' && b.reportDayOfWeek >= 0 && b.reportDayOfWeek <= 6) partial.reportDayOfWeek = Math.round(b.reportDayOfWeek);
  if (typeof b.reportHour === 'number' && b.reportHour >= 0 && b.reportHour <= 23) partial.reportHour = Math.round(b.reportHour);
  const updated = await updateSettings(partial);
  await rescheduleWeeklyReport(); // áp lịch báo cáo mới ngay
  res.json(updated);
});

// ============ KPI (Bảng xếp hạng thành viên) ============

apiRouter.get('/kpi', async (req: Request, res: Response) => {
  const result = await computeKpi(req.authMember!);
  res.json(result);
});

// ============ NOTIFICATIONS (Trung tâm thông báo) ============

apiRouter.get('/notifications', async (req: Request, res: Response) => {
  const me = req.authMember!;
  const items = await listNotifications(me.id, { unreadOnly: req.query.unread === '1' });
  res.json({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body ?? undefined,
      taskId: n.taskId ?? undefined,
      readAt: n.readAt?.toISOString(),
      createdAt: n.createdAt.toISOString(),
    })),
    unread: await unreadCount(me.id),
  });
});

apiRouter.get('/notifications/unread-count', async (req: Request, res: Response) => {
  res.json({ unread: await unreadCount(req.authMember!.id) });
});

apiRouter.post('/notifications/:id/read', async (req: Request, res: Response) => {
  await markRead(req.authMember!.id, req.params.id);
  res.json({ success: true });
});

apiRouter.post('/notifications/read-all', async (req: Request, res: Response) => {
  await markAllRead(req.authMember!.id);
  res.json({ success: true });
});

apiRouter.get('/notifications/prefs', async (req: Request, res: Response) => {
  res.json({ channel: await getPref(req.authMember!.id) });
});

apiRouter.put('/notifications/prefs', async (req: Request, res: Response) => {
  try {
    await setPref(req.authMember!.id, String(req.body?.channel || 'in_app'));
    res.json({ success: true, channel: req.body?.channel });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Quét deadline thủ công (phục vụ demo/kịch bản thử nghiệm S3 — bình thường cron 6h tự chạy)
apiRouter.post('/notifications/scan', requireCan(canScanDeadlines, ONLY_MANAGERS), async (_req: Request, res: Response) => {
  const result = await scanDeadlines();
  res.json({ success: true, ...result });
});

// ============ MEMBERS (Danh bạ) ============

// Mặc định trả về thành viên nhiệm kỳ hiện hành; ?all=1 để lấy tất cả; ?termId= để lọc
apiRouter.get('/members', async (req: Request, res: Response) => {
  const me = req.authMember!;
  const { termId, all } = req.query;
  const where: Record<string, unknown> = {};
  if (termId) {
    where.termId = String(termId);
  } else if (!all) {
    const activeTerm = await prisma.term.findFirst({ where: { isActive: true } });
    where.termId = activeTerm ? activeTerm.id : undefined;
  }
  const members = await prisma.member.findMany({ where });
  const ROLE_ORDER: Record<string, number> = {
    'Chủ nhiệm': 0,
    'Phó Chủ nhiệm': 1,
    'Trưởng ban': 2,
    'Phó ban': 3,
    'Thành viên': 4,
    'Cố vấn': 5,
  };
  const DEPT_ORDER: Record<string, number> = {
    'Ban Chủ nhiệm': 0,
    'Học thuật': 1,
    'Truyền thông': 2,
    'Sự kiện': 3,
    'Đối ngoại': 4,
  };
  members.sort(
    (a, b) =>
      (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
      (DEPT_ORDER[a.department] ?? 9) - (DEPT_ORDER[b.department] ?? 9) ||
      a.name.localeCompare(b.name, 'vi')
  );
  // Thông tin riêng (SĐT, MSV, lớp, ngày sinh) chỉ trả cho người có quyền xem — lọc ngay tại server
  res.json(members.map((m) => serializeMemberFor(me, m)));
});

/**
 * POST /members/import — Import file Excel danh bạ (multipart/form-data: file + termName).
 * Mỗi sheet = 1 ban; upsert theo email; nhiệm kỳ mới được đặt làm hiện hành.
 */
apiRouter.post('/members/import', requireCan(canManageTerms, ONLY_PRESIDENT), upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng đính kèm file Excel (.xlsx)' });
  }
  const termName = String(req.body?.termName || '').trim();
  if (!/^\d{4}-\d{4}$/.test(termName)) {
    return res.status(400).json({ error: 'Tên nhiệm kỳ phải theo định dạng YYYY-YYYY (VD: 2025-2026)' });
  }
  try {
    const summary = await importRosterFromExcel(req.file.buffer, termName);
    return res.json({ success: true, summary });
  } catch (e: any) {
    console.error('Excel import error:', e);
    return res.status(400).json({ error: 'Không đọc được file Excel. Kiểm tra lại định dạng danh bạ NITC.' });
  }
});

/** Email đã thuộc về thành viên/tài khoản khác chưa? (Member.email chưa unique ở CSDL nên phải kiểm tra ở đây) */
async function emailTakenByOther(email: string, exceptMemberId?: string): Promise<boolean> {
  const [member, user] = await Promise.all([
    prisma.member.findFirst({ where: { email, ...(exceptMemberId ? { id: { not: exceptMemberId } } : {}) } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  return Boolean(member) || Boolean(user && user.memberId !== exceptMemberId);
}

apiRouter.post('/members', requireCan(canManageRoster, ONLY_LEADERSHIP), async (req: Request, res: Response) => {
  const input = validate(memberCreateSchema, req.body);
  assertCan(canEditMember(req.authMember!, null, input.role), 'Chỉ Chủ nhiệm được bổ nhiệm Chủ nhiệm/Phó Chủ nhiệm');
  if (await emailTakenByOther(input.email)) {
    return res.status(409).json({ error: `Email ${input.email} đã có trong danh sách thành viên` });
  }
  if (input.id && (await prisma.member.findUnique({ where: { id: input.id } }))) {
    return res.status(409).json({ error: 'Mã thành viên đã tồn tại' });
  }

  const activeTerm = await getActiveTerm();
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  // Thành viên + tài khoản đăng nhập tạo cùng nhau — không để lại thành viên "mồ côi" tài khoản nếu lỗi giữa chừng
  const member = await prisma.$transaction(async (tx) => {
    const created = await tx.member.create({
      data: {
        id: input.id || undefined,
        name: input.name,
        role: input.role,
        department: input.department,
        email: input.email,
        phone: input.phone || null,
        studentId: input.studentId || null,
        className: input.className || null,
        termId: activeTerm.id,
      },
    });
    await tx.user.create({ data: { email: input.email, passwordHash, memberId: created.id } });
    return created;
  });
  return res.status(201).json(serializeMember(member));
});

apiRouter.put('/members/:id', requireCan(canManageRoster, ONLY_LEADERSHIP), async (req: Request, res: Response) => {
  const me = req.authMember!;
  const { id } = req.params;
  const input = validate(memberUpdateSchema, req.body);
  const existing = await prisma.member.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy thành viên' });
  assertCan(
    canEditMember(me, existing, input.role),
    'Chỉ Chủ nhiệm được sửa hồ sơ hoặc thay đổi vai trò Chủ nhiệm/Phó Chủ nhiệm'
  );

  if (input.email && input.email !== existing.email && (await emailTakenByOther(input.email, id))) {
    return res.status(409).json({ error: `Email ${input.email} đang được thành viên khác sử dụng` });
  }

  // Không tự khóa hệ thống: luôn phải còn ít nhất một Chủ nhiệm đang hoạt động
  const losesPresidency =
    existing.role === 'Chủ nhiệm' &&
    existing.status === 'active' &&
    ((input.role !== undefined && input.role !== 'Chủ nhiệm') || (input.status !== undefined && input.status !== 'active'));
  if (losesPresidency) {
    const others = await prisma.member.count({ where: { role: 'Chủ nhiệm', status: 'active', id: { not: id } } });
    if (others === 0) {
      return res.status(409).json({
        error: 'Đây là Chủ nhiệm duy nhất. Hãy bổ nhiệm Chủ nhiệm mới trước khi đổi vai trò hoặc ngưng hoạt động tài khoản này.',
      });
    }
  }
  if (id === me.id && input.status !== undefined && input.status !== 'active') {
    return res.status(409).json({ error: 'Bạn không thể tự ngưng hoạt động tài khoản của chính mình' });
  }

  const member = await prisma.$transaction(async (tx) => {
    const updated = await tx.member.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        role: input.role ?? undefined,
        department: input.department ?? undefined,
        email: input.email ?? undefined,
        phone: input.phone !== undefined ? input.phone || null : undefined,
        studentId: input.studentId !== undefined ? input.studentId || null : undefined,
        className: input.className !== undefined ? input.className || null : undefined,
        birthday: input.birthday !== undefined ? input.birthday || null : undefined,
        status: input.status ?? undefined,
      },
    });
    // Đồng bộ email tài khoản đăng nhập nếu đổi email
    if (input.email && input.email !== existing.email) {
      await tx.user.updateMany({ where: { memberId: id }, data: { email: input.email } });
    }
    return updated;
  });
  return res.json(serializeMember(member));
});

/**
 * POST /members/:id/reset-password — Chủ nhiệm đặt lại mật khẩu của thành viên về mật khẩu mặc định
 * (khi thành viên quên mật khẩu). Phiên đăng nhập cũ của họ hết hiệu lực ngay; lần đăng nhập tới
 * hệ thống buộc đổi mật khẩu.
 */
apiRouter.post('/members/:id/reset-password', requireCan(canResetMemberPassword, ONLY_PRESIDENT), async (req: Request, res: Response) => {
  const { id } = req.params;
  const member = await prisma.member.findUnique({ where: { id }, include: { user: true } });
  if (!member) return res.status(404).json({ error: 'Không tìm thấy thành viên' });

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  if (member.user) {
    await prisma.user.update({ where: { id: member.user.id }, data: { passwordHash } });
  } else {
    await prisma.user.create({ data: { email: member.email.toLowerCase(), passwordHash, memberId: member.id } });
  }
  return res.json({
    success: true,
    message: `Đã đặt lại mật khẩu của ${member.name} về mật khẩu mặc định. Họ sẽ phải đổi mật khẩu ở lần đăng nhập tới.`,
  });
});

apiRouter.delete('/members/:id', requireCan(canDeleteMember, ONLY_PRESIDENT), async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.member.findUnique({ where: { id }, include: { tasks: { select: { id: true } } } });
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy thành viên' });
  if (existing.role === 'Chủ nhiệm') {
    return res.status(403).json({ error: 'Không thể xóa Chủ nhiệm CLB' });
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
// Quyền: shared/permissions.ts · Trạng thái hợp lệ cho từng hành động: shared/taskState.ts · Ngày: shared/time.ts

const TASK_INCLUDE = { sourceMeeting: { select: { id: true, title: true } } } as const;

type TaskRow = { id: string; title: string; status: string; deadline: string; department: string; assigneeId: string; assigneeIds: string };

/**
 * Kiểm tra danh sách người phụ trách: phải có trong danh bạ, còn hoạt động và thuộc đúng ban của việc.
 * Trả về theo đúng thứ tự `ids` (người đầu tiên là phụ trách chính).
 */
async function resolveAssignees(ids: string[], department: string) {
  const found = await prisma.member.findMany({ where: { id: { in: ids } } });
  const byId = new Map(found.map((m) => [m.id, m]));
  return ids.map((id) => {
    const m = byId.get(id);
    if (!m) throw new HttpError(400, 'Người phụ trách không có trong danh sách thành viên');
    if (m.status !== 'active') throw new HttpError(400, `${m.name} không còn hoạt động nên không thể giao việc`);
    if (m.department !== department) throw new HttpError(400, `Người phụ trách ${m.name} không thuộc ban ${department}`);
    return m;
  });
}

/** Hành động không hợp lệ ở trạng thái hiện tại → 409 kèm lý do (VD: nộp lại trên việc đã hoàn thành). */
function assertTransition(
  action: Parameters<typeof transitionError>[0],
  task: { status: string; deadline: string },
  opts?: { allowQuickApprove?: boolean }
): void {
  const reason = transitionError(action, effectiveStatus(task), opts);
  if (reason) throw new HttpError(409, reason, 'INVALID_STATE');
}

/** Báo cho TẤT CẢ người phụ trách của việc (không chỉ người phụ trách chính). */
async function notifyAssignees(
  task: TaskRow,
  input: { type: Parameters<typeof notify>[0]['type']; title: string; body: string; dedupeKey: string },
  onlyIds?: string[]
): Promise<void> {
  for (const memberId of onlyIds ?? taskAssigneeIds(task)) {
    await notify({ ...input, memberId, taskId: task.id, dedupeKey: `${input.dedupeKey}:${memberId}` });
  }
}

// ?termId=... để xem việc của một nhiệm kỳ; mặc định trả mọi việc người dùng được xem
apiRouter.get('/tasks', async (req: Request, res: Response) => {
  const me = req.authMember!;
  const termId = typeof req.query.termId === 'string' && req.query.termId ? req.query.termId : undefined;
  const tasks = await prisma.task.findMany({
    where: termId ? { termId } : undefined,
    include: TASK_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks.filter((t) => canViewTask(me, t)).map(serializeTask));
});

apiRouter.post('/tasks', requireCan(canCreateTask, ONLY_MANAGERS), async (req: Request, res: Response) => {
  const me = req.authMember!;
  const b = validate(taskCreateSchema, req.body);

  // Trưởng ban/Phó ban chỉ giao việc trong phạm vi ban mình
  if (!canCreateTaskIn(me, b.department)) {
    return res.status(403).json({ error: 'Chỉ được giao việc cho ban của bạn' });
  }
  if (b.deadline < todayVN()) {
    throw new HttpError(400, 'Hạn chót không được ở trong quá khứ');
  }
  // Đa phụ trách: assigneeIds (nếu có) — người đầu tiên là phụ trách chính
  const ids: string[] = Array.from(new Set([b.assigneeId, ...b.assigneeIds]));
  const assignees = await resolveAssignees(ids, b.department);
  const activeTerm = await getActiveTerm();

  const task = await prisma.task.create({
    data: {
      title: b.title,
      description: b.description || null,
      assigneeId: b.assigneeId,
      assigneeName: assignees[0].name,
      assigneeIds: JSON.stringify(ids),
      department: b.department,
      deadline: b.deadline,
      status: 'in_progress', // việc mới luôn bắt đầu ở "đang làm" — không nhận status từ client
      verificationType: b.verificationType,
      priority: b.priority,
      isSticky: false,
      sourceMeetingId: b.sourceMeetingId || null,
      createdById: me.id,
      termId: activeTerm.id,
    },
    include: TASK_INCLUDE,
  });
  await notifyAssignees(task, {
    type: 'task_assigned',
    title: ids.length > 1 ? '📌 Công việc nhóm — bạn được giao cùng' : '📌 Bạn được giao việc mới',
    body: `"${task.title}" — hạn chót ${task.deadline}${ids.length > 1 ? ` (cùng ${ids.length - 1} người khác)` : ''}. Xem chi tiết trong Bảng điều hành.`,
    dedupeKey: `task_assigned:${task.id}`,
  });
  return res.status(201).json(serializeTask(task));
});

/**
 * PUT /tasks/:id — hành động tường minh theo `action`:
 *  - submit_evidence / request_update: chỉ người được giao
 *  - approve / reject / respond_update: Ban lãnh đạo, hoặc Trưởng/Phó ban của ban đó (không tự duyệt việc của mình)
 *  - update: sửa thông tin (Ban lãnh đạo, hoặc Trưởng/Phó ban trong ban mình)
 * Mỗi hành động chỉ hợp lệ ở một số trạng thái (shared/taskState.ts) — sai trạng thái trả 409.
 */
apiRouter.put('/tasks/:id', requireAuth, async (req: Request, res: Response) => {
  const me = req.authMember!;
  const { id } = req.params;
  const input = validate(taskActionSchema, req.body);

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: 'Không tìm thấy nhiệm vụ' });
  if (!canViewTask(me, task)) return res.status(403).json({ error: 'Bạn không có quyền với nhiệm vụ này' });

  const now = new Date();
  // Dọn yêu cầu cập nhật minh chứng đang treo (khi việc rời trạng thái chờ duyệt)
  const clearUpdateRequest = { updateRequestedAt: null, updateRequestNote: null, updateRequestById: null };

  if (input.action === 'submit_evidence') {
    // Chỉ người được giao mới nộp minh chứng — không nộp hộ, kể cả người cùng ban hay cấp trên
    assertCan(canSubmitEvidence(me, task), 'Chỉ người được giao việc mới được nộp minh chứng');
    assertTransition('submit_evidence', task);
    const link = input.link || null;
    const report = (input.report || '').trim() || null;
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
      include: TASK_INCLUDE,
    });
    // Khóa chống trùng theo từng lần nộp: nộp lại sau khi bị trả vẫn báo cho người duyệt
    await notifyReviewers(task, {
      type: 'evidence_submitted',
      title: '📥 Minh chứng chờ duyệt',
      body: `${me.name} đã nộp minh chứng cho "${task.title}". Vào Bảng điều hành để nghiệm thu.`,
      dedupeKey: `evidence_submitted:${task.id}:${now.getTime()}`,
    }, me.id);
    return res.json(serializeTask(updated));
  }

  if (input.action === 'approve') {
    assertCan(canReviewTask(me, task), REVIEW_DENIED);
    // Việc chưa nộp minh chứng: chỉ Chủ nhiệm được "duyệt nhanh"
    assertTransition('approve', task, { allowQuickApprove: isPresident(me) });
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: 'completed',
        approvalNote: input.note || `${me.name} (${me.role}) đã duyệt hoàn thành.`,
        approvedById: me.id,
        approvedAt: now,
        rejectedReason: null,
        ...clearUpdateRequest,
        updatedAt: now,
      },
      include: TASK_INCLUDE,
    });
    await notifyAssignees(task, {
      type: 'evidence_approved',
      title: '✅ Việc đã được nghiệm thu',
      body: `"${task.title}" đã hoàn thành — ${me.name} duyệt. ${input.note || ''}`.trim(),
      dedupeKey: `approved:${task.id}:${now.getTime()}`,
    });
    return res.json(serializeTask(updated));
  }

  if (input.action === 'reject') {
    assertCan(canReviewTask(me, task), REVIEW_DENIED);
    assertTransition('reject', task);
    const reason = input.reason;
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: 'in_progress',
        rejectedReason: reason,
        ...clearUpdateRequest,
        updatedAt: now,
      },
      include: TASK_INCLUDE,
    });
    await notifyAssignees(task, {
      type: 'evidence_rejected',
      title: '↩️ Minh chứng bị trả lại',
      body: `"${task.title}" cần làm lại. Lý do: ${reason}`,
      dedupeKey: `rejected:${task.id}:${now.getTime()}`,
    });
    return res.json(serializeTask(updated));
  }

  // Gửi yêu cầu cập nhật minh chứng (người làm, khi đang chờ duyệt)
  if (input.action === 'request_update') {
    assertCan(canSubmitEvidence(me, task), 'Chỉ người được giao việc mới được xin cập nhật minh chứng');
    assertTransition('request_update', task);
    const note = (input.note || '').trim();
    const updated = await prisma.task.update({
      where: { id },
      data: {
        updateRequestedAt: now.toISOString(),
        updateRequestNote: note || null,
        updateRequestById: me.id,
      },
      include: TASK_INCLUDE,
    });
    // Thông báo cho những người có quyền duyệt: Ban lãnh đạo + Trưởng/Phó ban của ban đó
    await notifyReviewers(task, {
      type: 'update_request',
      title: '🔄 Yêu cầu cập nhật minh chứng',
      body: `${me.name} muốn cập nhật minh chứng cho "${task.title}".${note ? ` Ghi chú: ${note}` : ''}`,
      dedupeKey: `update_req:${task.id}:${now.getTime()}`,
    }, me.id);
    return res.json(serializeTask(updated));
  }

  // Phản hồi yêu cầu cập nhật (người có quyền duyệt) — điền feedback
  if (input.action === 'respond_update') {
    assertCan(canReviewTask(me, task), REVIEW_DENIED);
    assertTransition('respond_update', task);
    if (!task.updateRequestedAt) return res.status(400).json({ error: 'Không có yêu cầu cập nhật nào đang chờ' });
    const feedback = input.feedback;
    const decision = input.decision === 'approve' ? 'approve' : 'reject';
    const updated = await prisma.task.update({
      where: { id },
      data: {
        updateFeedback: `${me.name}: ${feedback}`,
        ...clearUpdateRequest,
        ...(decision === 'approve' ? { status: 'in_progress' } : {}),
        updatedAt: now,
      },
      include: TASK_INCLUDE,
    });
    await notifyAssignees(task, {
      type: 'update_request',
      title: decision === 'approve' ? '✅ Được phép cập nhật minh chứng' : '❌ Yêu cầu cập nhật không được duyệt',
      body: `"${task.title}" — Phản hồi: ${feedback}${decision === 'approve' ? ' Bạn có thể chỉnh sửa và nộp lại minh chứng.' : ' Minh chứng hiện tại được giữ nguyên.'}`,
      dedupeKey: `update_res:${task.id}:${now.getTime()}`,
    });
    return res.json(serializeTask(updated));
  }

  if (input.action === 'update') {
    const b = input;
    // Đổi ban phụ trách -> kiểm tra quyền quản lý cả ban cũ lẫn ban mới
    const newDept = b.department ?? task.department;
    if (!canEditTask(me, task) || !canCreateTaskIn(me, newDept)) {
      return res.status(403).json({ error: 'Không có quyền sửa nhiệm vụ này' });
    }
    // Việc đã hoàn thành: không đổi hạn/người làm/ban (làm lệch điểm KPI đã chốt)
    if (task.status === 'completed') {
      const locked = Object.entries(b).filter(
        ([k, v]) => k !== 'action' && v !== undefined && !(Array.isArray(v) && v.length === 0) && !COMPLETED_EDITABLE_FIELDS.includes(k)
      );
      if (locked.length > 0) {
        throw new HttpError(409, 'Việc đã hoàn thành chỉ còn sửa được tiêu đề, mô tả và mức ưu tiên', 'INVALID_STATE');
      }
    }
    const deadlineChanged = b.deadline !== undefined && b.deadline !== task.deadline;
    if (deadlineChanged && b.deadline! < todayVN()) {
      throw new HttpError(400, 'Hạn chót mới không được ở trong quá khứ');
    }

    // Đồng bộ người phụ trách: assigneeId (phụ trách chính) và assigneeIds (toàn bộ) luôn khớp nhau
    const oldIds = taskAssigneeIds(task);
    let newIds = oldIds;
    if (b.assigneeIds.length > 0) {
      const primary = b.assigneeId ?? (b.assigneeIds.includes(task.assigneeId) ? task.assigneeId : b.assigneeIds[0]);
      newIds = Array.from(new Set([primary, ...b.assigneeIds]));
    } else if (b.assigneeId && b.assigneeId !== task.assigneeId) {
      // Đổi phụ trách chính: người mới thế chỗ người cũ, các đồng phụ trách giữ nguyên
      newIds = Array.from(new Set([b.assigneeId, ...oldIds.filter((x) => x !== task.assigneeId)]));
    }
    const assigneesChanged = newIds.join('|') !== oldIds.join('|');
    let primaryName = task.assigneeName;
    if (assigneesChanged || newDept !== task.department) {
      // Mọi người phụ trách phải thuộc ban (mới) của việc và còn hoạt động
      primaryName = (await resolveAssignees(newIds, newDept))[0].name;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        title: b.title ?? undefined,
        description: b.description !== undefined ? b.description || null : undefined,
        assigneeId: newIds[0],
        assigneeName: primaryName,
        assigneeIds: JSON.stringify(newIds),
        department: b.department ?? undefined,
        deadline: b.deadline ?? undefined,
        priority: b.priority ?? undefined,
        verificationType: b.verificationType ?? undefined,
        isSticky: b.isSticky ?? undefined,
        updatedAt: now,
      },
      include: TASK_INCLUDE,
    });

    const added = newIds.filter((x) => !oldIds.includes(x));
    if (added.length > 0) {
      await notifyAssignees(updated, {
        type: 'task_assigned',
        title: '📌 Bạn được giao việc mới',
        body: `"${updated.title}" — hạn chót ${updated.deadline}. Xem chi tiết trong Bảng điều hành.`,
        dedupeKey: `task_assigned:${task.id}`,
      }, added);
    }
    if (deadlineChanged && updated.status !== 'completed') {
      await notifyAssignees(updated, {
        type: 'task_assigned',
        title: '🗓️ Hạn chót đã thay đổi',
        body: `"${updated.title}": hạn chót đổi từ ${task.deadline} sang ${updated.deadline} (${me.name} cập nhật).`,
        dedupeKey: `deadline_changed:${task.id}:${now.getTime()}`,
      }, newIds.filter((x) => !added.includes(x)));
    }
    return res.json(serializeTask(updated));
  }

  // Không tới được đây: taskActionSchema đã chặn mọi action ngoài danh mục
  throw new HttpError(400, 'Action không hợp lệ');
});

apiRouter.delete('/tasks/:id', requireCan(canDeleteTask, ONLY_PRESIDENT), async (req: Request, res: Response) => {
  const { id } = req.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: 'Không tìm thấy nhiệm vụ' });
  await prisma.task.delete({ where: { id } });
  return res.json({ success: true });
});

/**
 * POST /tasks/:id/remind — Nhắc nộp minh chứng công việc
 * Quyền:
 *  - Ban lãnh đạo (Chủ nhiệm, Phó Chủ nhiệm): nhắc mọi nhiệm vụ
 *  - Trưởng ban, Phó ban: nhắc nhiệm vụ thuộc ban của mình
 * Chỉ nhắc được việc còn mở (đang làm / quá hạn).
 */
apiRouter.post('/tasks/:id/remind', requireAuth, async (req: Request, res: Response) => {
  const me = req.authMember!;
  const { id } = req.params;
  const { note } = validate(remindSchema, req.body);

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: 'Không tìm thấy nhiệm vụ' });

  if (!canRemindTask(me, task)) {
    return res.status(403).json({ error: 'Bạn không có quyền nhắc nộp nhiệm vụ này' });
  }
  assertTransition('remind', task);

  const memberIds = taskAssigneeIds(task);
  const now = new Date();
  const isOverdue = effectiveStatus(task) === 'overdue';
  const prefix = isOverdue ? '🚨 [KHẨN] Nhắc nộp minh chứng quá hạn' : '🔔 Nhắc nộp minh chứng công việc';
  const customNoteStr = typeof note === 'string' && note.trim() ? ` Lời nhắn: "${note.trim()}".` : '';

  await notifyAssignees(task, {
    type: isOverdue ? 'overdue' : 'task_assigned',
    title: `${prefix}: ${task.title}`,
    body: `${me.name} (${me.role} - ${me.department}) vừa gửi lời nhắc nộp minh chứng cho việc "${task.title}". Hạn chót: ${task.deadline}.${customNoteStr} Vui lòng nộp sớm!`,
    dedupeKey: `remind:${task.id}:${now.getTime()}`,
  });

  // Ghi nhật ký Nag Engine
  await prisma.notificationLog.create({
    data: {
      type: 'overdue_nag',
      recipientName: task.assigneeName,
      recipientEmail: 'in-app',
      department: task.department,
      subject: `${prefix}: ${task.title}`,
      content: `Người nhắc: ${me.name} (${me.role}). Nhiệm vụ: "${task.title}". Hạn chót: ${task.deadline}.${customNoteStr} Đã gửi đến ${memberIds.length} người phụ trách.`,
      status: 'sent',
      sentAt: now,
      taskCount: 1,
    },
  });

  return res.json({
    success: true,
    message: `Đã gửi lời nhắc nộp minh chứng đến ${task.assigneeName}!`,
    remindedCount: memberIds.length,
  });
});

// ============ MEETINGS (Kho BBH) ============

apiRouter.get('/meetings', async (req: Request, res: Response) => {
  const me = req.authMember!;
  const termId = typeof req.query.termId === 'string' && req.query.termId ? req.query.termId : undefined;
  const meetings = await prisma.meeting.findMany({ where: termId ? { termId } : undefined, orderBy: { createdAt: 'desc' } });
  // Thành viên/Trưởng ban: chỉ thấy kỳ họp toàn CLB + kỳ họp riêng của ban mình
  const visible = meetings.filter((m) => canViewMeeting(me, m));
  res.json(visible.map(serializeMeeting));
});

/**
 * POST /meetings/publish — Ban hành kỳ họp + bộ nhiệm vụ (Presidential Filter → Bảng điều hành).
 * Kỳ họp và toàn bộ nhiệm vụ được ghi trong MỘT transaction; thông báo gửi sau khi commit.
 */
apiRouter.post('/meetings/publish', requireCan(canPublishMeeting, ONLY_MANAGERS), async (req: Request, res: Response) => {
  const me = req.authMember!;
  const isDeptHead = !isLeadership(me); // Trưởng/Phó ban: chỉ trong phạm vi ban mình
  const { meeting, tasks } = validate(publishSchema, req.body);

  // Trưởng ban/Phó ban: chỉ được họp riêng & ban hành việc trong phạm vi ban mình
  const meetingDepartment = isDeptHead ? me.department : (meeting.department || 'Ban Chủ nhiệm');
  if (isDeptHead) {
    const crossDept = tasks.filter((t) => t.suggestedDepartment !== me.department);
    if (crossDept.length > 0) {
      return res.status(403).json({ error: `Bạn chỉ được ban hành việc thuộc ban ${me.department}. Có ${crossDept.length} việc thuộc ban khác.` });
    }
  }

  // Kiểm tra đa phụ trách TRƯỚC khi vào transaction (không trả res trong tx)
  const normalizedTasks = [];
  for (const t of tasks) {
    const rawIds: string[] = t.suggestedAssigneeIds.length > 0
      ? t.suggestedAssigneeIds
      : t.suggestedAssigneeId ? [t.suggestedAssigneeId] : [];
    if (rawIds.length === 0) {
      return res.status(400).json({ error: `Việc "${t.title}" chưa có người phụ trách` });
    }
    if (t.suggestedDeadline < meeting.date) {
      return res.status(400).json({ error: `Việc "${t.title}" có hạn chót ${t.suggestedDeadline} trước cả ngày họp ${meeting.date}` });
    }
    let primaryName = '';
    for (const id of rawIds) {
      const mem = await prisma.member.findUnique({ where: { id } });
      if (!mem) return res.status(400).json({ error: `Người phụ trách không có trong danh sách (id: ${id})` });
      if (mem.status !== 'active') {
        return res.status(400).json({ error: `${mem.name} không còn hoạt động nên không thể giao việc` });
      }
      if (mem.department !== t.suggestedDepartment) {
        return res.status(400).json({ error: `Người phụ trách ${mem.name} không thuộc ban ${t.suggestedDepartment}` });
      }
      if (id === rawIds[0]) primaryName = mem.name;
    }
    normalizedTasks.push({ ...t, ids: rawIds, primaryName });
  }

  const activeTerm = await getActiveTerm();
  const created = await prisma.$transaction(async (tx) => {
    const m = await tx.meeting.create({
      data: {
        termId: activeTerm.id,
        id: meeting.id || undefined,
        title: meeting.title,
        department: meetingDepartment,
        date: meeting.date,
        time: meeting.time || null,
        location: meeting.location || null,
        chairperson: meeting.chairperson || me.name,
        secretary: meeting.secretary || '',
        attendees: JSON.stringify(meeting.attendees),
        absentees: JSON.stringify(meeting.absentees),
        latecomers: JSON.stringify(meeting.latecomers),
        objectives: meeting.objectives || '',
        discussionSummary: meeting.discussionSummary || '',
        actionPlan: meeting.actionPlan || '',
        rawContent: meeting.rawContent || '',
      },
    });

    const newTasks = [];
    for (const t of normalizedTasks) {
      const task = await tx.task.create({
        data: {
          title: t.title,
          description: t.description || null,
          assigneeId: t.ids[0],
          assigneeName: t.primaryName || 'Chưa gán',
          assigneeIds: JSON.stringify(t.ids),
          department: t.suggestedDepartment,
          deadline: t.suggestedDeadline,
          status: 'in_progress',
          verificationType: t.verificationType,
          priority: t.priority,
          isSticky: false,
          sourceMeetingId: m.id,
          createdById: me.id,
          termId: activeTerm.id,
        },
        include: { sourceMeeting: { select: { id: true, title: true } } },
      });
      newTasks.push(serializeTask(task));
    }
    return { meeting: serializeMeeting(m), tasks: newTasks };
  });

  // --- Sau khi commit: gửi thông báo (ngoài transaction, tránh deadlock SQLite) ---
  for (const t of created.tasks) {
    const memberIds = t.assigneeIds?.length ? t.assigneeIds : [t.assigneeId];
    for (const memberId of memberIds) {
      await notify({
        memberId,
        type: 'task_assigned',
        title: memberIds.length > 1 ? '📌 Công việc nhóm — bạn được giao cùng' : '📌 Bạn được giao việc mới từ biên bản họp',
        body: `"${t.title}" — hạn chót ${t.deadline} (nguồn: "${created.meeting.title}").`,
        taskId: t.id,
        dedupeKey: `task_assigned:${t.id}:${memberId}`,
      });
    }
  }
  await notifyLeadership({
    type: 'task_assigned',
    title: '✅ Đã ban hành kỳ họp mới',
    body: `"${created.meeting.title}" (${created.meeting.department}): ${created.tasks.length} việc đã lên bảng điều hành.`,
    dedupeKey: `published:${created.meeting.id}`,
  });

  return res.status(201).json(created);
});

// ============ LOGS (Nhật ký Nag) ============

// Ban lãnh đạo xem nhật ký toàn CLB; Trưởng/Phó ban chỉ xem nhật ký nhắc việc của ban mình
apiRouter.get(
  '/logs',
  requireCan(canViewLogs, 'Chỉ Ban lãnh đạo hoặc Trưởng/Phó ban được xem nhật ký'),
  async (req: Request, res: Response) => {
    const department = logDepartmentScope(req.authMember!);
    const logs = await prisma.notificationLog.findMany({
      where: department ? { department } : undefined,
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    res.json(logs.map(serializeLog));
  }
);

apiRouter.post('/logs', requireCan(canWriteLogs, 'Chỉ Ban lãnh đạo được ghi nhật ký'), async (req: Request, res: Response) => {
  const b = validate(logCreateSchema, req.body);
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
// Hai thao tác này XÓA SẠCH dữ liệu hiện có nên mặc định bị khóa (ALLOW_DESTRUCTIVE_ADMIN=true mới mở).
// Trước khi xóa, server tự sao lưu CSDL; phần xóa + ghi lại nằm trong MỘT transaction —
// lỗi giữa chừng thì dữ liệu cũ còn nguyên.

function requireDestructiveAdmin(_req: Request, res: Response, next: NextFunction) {
  if (!config.allowDestructiveAdmin) {
    return res.status(403).json({
      code: 'DESTRUCTIVE_ADMIN_DISABLED',
      error:
        'Chức năng này xóa toàn bộ dữ liệu hiện có nên đang bị khóa. Nếu thật sự cần, đặt ALLOW_DESTRUCTIVE_ADMIN=true trong .env rồi khởi động lại server.',
    });
  }
  return next();
}

apiRouter.post('/admin/import', requireCan(canDestructiveAdmin, ONLY_PRESIDENT), requireDestructiveAdmin, async (req: Request, res: Response) => {
  const data = validate(adminImportSchema, req.body);
  const logs = data.logs ?? [];

  // Kiểm tra tính nhất quán TRƯỚC khi xóa bất cứ thứ gì
  if (!data.members.some((m) => m.role === 'Chủ nhiệm')) {
    throw new HttpError(400, 'Dữ liệu import không có Chủ nhiệm — import sẽ khiến không ai quản trị được hệ thống');
  }
  const emails = new Set<string>();
  const memberIds = new Set<string>();
  for (const m of data.members) {
    if (emails.has(m.email)) throw new HttpError(400, `Dữ liệu import có email trùng: ${m.email}`);
    if (memberIds.has(m.id)) throw new HttpError(400, `Dữ liệu import có mã thành viên trùng: ${m.id}`);
    emails.add(m.email);
    memberIds.add(m.id);
  }
  const meetingIds = new Set(data.meetings.map((m) => m.id));
  for (const t of data.tasks) {
    if (!memberIds.has(t.assigneeId)) {
      throw new HttpError(400, `Việc "${t.title}" giao cho người không có trong danh sách thành viên import`);
    }
  }

  const backupFile = await backupDatabase('pre-import');
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const activeTerm = await getActiveTerm();

  await prisma.$transaction(
    async (tx) => {
      await tx.user.deleteMany();
      await tx.task.deleteMany();
      await tx.meeting.deleteMany();
      await tx.notificationLog.deleteMany();
      await tx.member.deleteMany();

      for (const m of data.members) {
        await tx.member.create({
          data: {
            id: m.id, name: m.name, role: m.role, department: m.department, email: m.email,
            phone: m.phone || null, studentId: m.studentId || null, className: m.className || null,
            birthday: m.birthday || null,
            termId: activeTerm.id, // gắn nhiệm kỳ hiện hành — nếu không, danh bạ mặc định sẽ hiện rỗng
          },
        });
        await tx.user.create({ data: { email: m.email, passwordHash, memberId: m.id } });
      }
      for (const mt of data.meetings) {
        await tx.meeting.create({
          data: {
            id: mt.id, title: mt.title, date: mt.date, termId: activeTerm.id,
            department: mt.department || 'Ban Chủ nhiệm',
            chairperson: mt.chairperson || '', secretary: mt.secretary || '',
            attendees: JSON.stringify(mt.attendees),
            absentees: JSON.stringify(mt.absentees),
            latecomers: JSON.stringify(mt.latecomers),
            objectives: mt.objectives || '',
            discussionSummary: mt.discussionSummary || '',
            actionPlan: mt.actionPlan || '',
            rawContent: mt.rawContent || '',
            createdAt: mt.createdAt ? new Date(mt.createdAt) : new Date(),
          },
        });
      }
      for (const t of data.tasks) {
        const ids = Array.from(new Set([t.assigneeId, ...t.assigneeIds.filter((x) => memberIds.has(x))]));
        await tx.task.create({
          data: {
            id: t.id, title: t.title, description: t.description || null, termId: activeTerm.id,
            assigneeId: t.assigneeId, assigneeName: t.assigneeName, assigneeIds: JSON.stringify(ids),
            department: t.department,
            deadline: t.deadline, status: t.status, verificationType: t.verificationType,
            evidenceLink: t.evidenceLink || null, evidenceReport: t.evidenceReport || null,
            evidenceSubmittedAt: t.evidenceSubmittedAt || null,
            approvalNote: t.approvalNote || null, rejectedReason: t.rejectedReason || null,
            sourceMeetingId: t.sourceMeetingId && meetingIds.has(t.sourceMeetingId) ? t.sourceMeetingId : null,
            priority: t.priority || null,
            isSticky: t.isSticky || false, stickyWeeksCount: t.stickyWeeksCount ?? null,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          },
        });
      }
      for (const lg of logs) {
        await tx.notificationLog.create({
          data: {
            id: lg.id || undefined, type: lg.type || 'overdue_nag',
            recipientName: lg.recipientName || '', recipientEmail: lg.recipientEmail || '',
            department: lg.department || null, subject: lg.subject || '', content: lg.content || '',
            sentAt: lg.sentAt ? new Date(lg.sentAt) : new Date(),
            status: lg.status || 'sent', taskCount: lg.taskCount ?? null,
          },
        });
      }
    },
    { timeout: 120_000, maxWait: 15_000 }
  );

  return res.json({
    success: true,
    backup: path.basename(backupFile),
    imported: { members: data.members.length, meetings: data.meetings.length, tasks: data.tasks.length, logs: logs.length },
  });
});

apiRouter.post('/admin/reset', requireCan(canDestructiveAdmin, ONLY_PRESIDENT), requireDestructiveAdmin, async (_req: Request, res: Response) => {
  const backupFile = await backupDatabase('pre-reset');
  await resetAndSeed();
  return res.json({ success: true, backup: path.basename(backupFile) });
});
