export type Department =
  | 'Học thuật'
  | 'Truyền thông'
  | 'Sự kiện'
  | 'Đối ngoại'
  | 'Ban Chủ nhiệm';

export type Role =
  | 'Chủ nhiệm'
  | 'Phó Chủ nhiệm'
  | 'Trưởng ban'
  | 'Phó ban'
  | 'Thành viên'
  | 'Cố vấn';

export type VerificationType = 'link_required' | 'report_required';

export type TaskStatus =
  | 'draft'
  | 'in_progress'
  | 'pending_approval'
  | 'completed'
  | 'overdue';

export interface Member {
  id: string;
  name: string;
  role: Role;
  department: Department;
  email: string;
  phone?: string;
  studentId?: string; // Mã sinh viên (MSV)
  className?: string; // Lớp (VD: IT67A)
  birthday?: string; // dd/MM/yyyy
  status?: string; // active | inactive | alumni
  termId?: string; // Nhiệm kỳ sở hữu thành viên này
  avatar?: string;
}

export interface Term {
  id: string;
  name: string; // "2025-2026"
  isActive: boolean;
  memberCount: number;
}

export interface AppNotification {
  id: string;
  type: 'task_assigned' | 'deadline_tomorrow' | 'deadline_today' | 'overdue' | 'evidence_submitted' | 'evidence_approved' | 'evidence_rejected' | 'sticky_carried' | 'weekly_summary' | 'broadcast';
  title: string;
  body?: string;
  taskId?: string;
  readAt?: string;
  createdAt: string;
}

export interface ImportSummary {
  term: string;
  created: number;
  updated: number;
  skipped: number;
  skippedRows: string[];
  departments: Record<string, number>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeId: string; // phụ trách chính (người đầu tiên)
  assigneeName: string;
  assigneeIds?: string[]; // giao nhiều người / cả ban
  department: Department;
  deadline: string; // YYYY-MM-DD
  status: TaskStatus;
  verificationType: VerificationType;
  evidenceLink?: string;
  evidenceReport?: string;
  evidenceSubmittedAt?: string;
  approvalNote?: string;
  rejectedReason?: string;
  sourceMeetingId?: string;
  sourceMeetingTitle?: string;
  isSticky?: boolean; // Nhiệm vụ lưu chuyển từ tuần trước
  stickyWeeksCount?: number;
  priority?: 'high' | 'medium' | 'normal';
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedDraftTask {
  tempId: string;
  title: string;
  description?: string;
  rawAssigneeText: string;
  suggestedAssigneeId?: string;
  suggestedAssigneeName?: string;
  suggestedAssigneeIds?: string[]; // giao nhiều người / cả ban
  suggestedDepartment: Department;
  rawDeadlinetext: string;
  suggestedDeadline: string; // YYYY-MM-DD
  verificationType: VerificationType;
  hasAmbiguity: boolean;
  ambiguityMatches: Array<{
    id: string;
    name: string;
    department: Department;
    role: Role;
  }>;
  isAbsentee: boolean;
  absenteeName?: string;
  warningMessages: string[];
  approved: boolean;
  priority: 'high' | 'medium' | 'normal';
  reasoning?: string;
}

export interface DraftParseResult {
  meetingTitle: string;
  meetingDate: string;
  chairperson: string;
  secretary: string;
  attendees: string[];
  absentees: string[];
  rawBBH: string;
  draftTasks: ExtractedDraftTask[];
}

export interface Meeting {
  id: string;
  title: string;
  department?: string; // "Ban Chủ nhiệm" = toàn CLB; còn lại = họp riêng ban
  date: string; // YYYY-MM-DD
  time?: string;
  location?: string;
  chairperson: string;
  secretary: string;
  attendees: string[];
  absentees: string[];
  latecomers?: string[];
  objectives?: string;
  discussionSummary: string;
  actionPlan: string;
  rawContent: string;
  taskCount?: number;
  completedTaskCount?: number;
  createdAt: string;
}

export interface NotificationLog {
  id: string;
  type: 'weekly_summary' | 'overdue_nag' | 'task_assigned' | 'evidence_approved' | 'evidence_rejected';
  recipientName: string;
  recipientEmail: string;
  department?: Department;
  subject: string;
  content: string;
  sentAt: string;
  status: 'sent' | 'queued' | 'failed';
  taskCount?: number;
}
