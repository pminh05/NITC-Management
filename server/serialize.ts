// Chuyển đổi giữa representation CSDL (Prisma) và shape JSON mà frontend đang dùng
// (giữ nguyên kiểu dữ liệu của src/types.ts để UI ít phải sửa)

export function serializeTask(t: {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  assigneeName: string;
  department: string;
  deadline: string;
  status: string;
  verificationType: string;
  evidenceLink: string | null;
  evidenceReport: string | null;
  evidenceSubmittedAt: string | null;
  approvalNote: string | null;
  rejectedReason: string | null;
  sourceMeetingId: string | null;
  priority: string | null;
  isSticky: boolean;
  stickyWeeksCount: number | null;
  createdAt: Date;
  updatedAt: Date;
  sourceMeeting?: { id: string; title: string } | null;
}) {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    assigneeId: t.assigneeId,
    assigneeName: t.assigneeName,
    department: t.department,
    deadline: t.deadline,
    status: t.status,
    verificationType: t.verificationType,
    evidenceLink: t.evidenceLink ?? undefined,
    evidenceReport: t.evidenceReport ?? undefined,
    evidenceSubmittedAt: t.evidenceSubmittedAt ?? undefined,
    approvalNote: t.approvalNote ?? undefined,
    rejectedReason: t.rejectedReason ?? undefined,
    sourceMeetingId: t.sourceMeetingId ?? undefined,
    sourceMeetingTitle: t.sourceMeeting?.title,
    isSticky: t.isSticky,
    stickyWeeksCount: t.stickyWeeksCount ?? undefined,
    priority: (t.priority as 'high' | 'medium' | 'normal' | undefined) ?? undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializeMeeting(m: {
  id: string;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  chairperson: string;
  secretary: string;
  attendees: string;
  absentees: string;
  discussionSummary: string;
  actionPlan: string;
  rawContent: string;
  createdAt: Date;
}) {
  let attendees: string[] = [];
  let absentees: string[] = [];
  try { attendees = JSON.parse(m.attendees); } catch { attendees = []; }
  try { absentees = JSON.parse(m.absentees); } catch { absentees = []; }
  return {
    id: m.id,
    title: m.title,
    date: m.date,
    time: m.time ?? undefined,
    location: m.location ?? undefined,
    chairperson: m.chairperson,
    secretary: m.secretary,
    attendees,
    absentees,
    discussionSummary: m.discussionSummary,
    actionPlan: m.actionPlan,
    rawContent: m.rawContent,
    createdAt: m.createdAt.toISOString(),
  };
}

export function serializeMember(m: {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string | null;
  studentId: string | null;
  className: string | null;
  birthday: string | null;
  status: string;
  termId: string | null;
}) {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    department: m.department,
    email: m.email,
    phone: m.phone ?? undefined,
    studentId: m.studentId ?? undefined,
    className: m.className ?? undefined,
    birthday: m.birthday ?? undefined,
    status: m.status,
    termId: m.termId ?? undefined,
  };
}

export function serializeLog(l: {
  id: string;
  type: string;
  recipientName: string;
  recipientEmail: string;
  department: string | null;
  subject: string;
  content: string;
  sentAt: Date;
  status: string;
  taskCount: number | null;
}) {
  return {
    id: l.id,
    type: l.type,
    recipientName: l.recipientName,
    recipientEmail: l.recipientEmail,
    department: l.department ?? undefined,
    subject: l.subject,
    content: l.content,
    sentAt: l.sentAt.toISOString(),
    status: l.status,
    taskCount: l.taskCount ?? undefined,
  };
}
