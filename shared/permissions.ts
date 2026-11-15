// MA TRẬN PHÂN QUYỀN — nguồn duy nhất, dùng chung cho server (server/permissions.ts) và giao diện (src/).
// Tệp này chỉ chứa hàm thuần (không import gì) để cả Node lẫn trình duyệt cùng dùng một bộ quy tắc:
// nút nào giao diện hiện ra thì server chắc chắn cho phép, và ngược lại.
//
// Vai trò:
//   Chủ nhiệm      — toàn quyền.
//   Phó Chủ nhiệm  — như Chủ nhiệm, TRỪ: xóa (việc/thành viên), cấu hình hệ thống, nhiệm kỳ & import danh bạ,
//                    reset/import toàn bộ dữ liệu, đặt lại mật khẩu, và mọi thay đổi liên quan vai trò lãnh đạo.
//   Trưởng/Phó ban — quản lý trong phạm vi ban mình: giao việc, sửa việc, nhắc việc, duyệt minh chứng,
//                    ban hành kỳ họp riêng, đăng tài liệu; xem đủ hồ sơ thành viên ban mình.
//   Thành viên, Cố vấn — xem việc của ban mình + việc được giao; nộp minh chứng việc được giao cho chính mình.
//
// Hai nguyên tắc xuyên suốt:
//   1. Chỉ người được giao mới nộp minh chứng (không nộp hộ).
//   2. Không tự duyệt việc của chính mình (trừ Chủ nhiệm — cấp cao nhất, không còn ai duyệt thay).

export interface Actor {
  id: string;
  role: string;
  department: string;
}

export interface TaskRef {
  department: string;
  assigneeId: string;
  /** Mảng id (JSON từ API) hoặc chuỗi JSON (bản ghi CSDL) */
  assigneeIds?: unknown;
}

export interface MemberRef {
  id: string;
  role: string;
  department: string;
}

export const LEADERSHIP_ROLES = ['Chủ nhiệm', 'Phó Chủ nhiệm'];
export const DEPT_MANAGER_ROLES = ['Trưởng ban', 'Phó ban'];
/** Ban dùng cho kỳ họp toàn CLB và tài liệu chung */
export const COMMON_DEPARTMENT = 'Ban Chủ nhiệm';

// ----- Vai trò -----

export function isPresident(a?: Actor | null): boolean {
  return a?.role === 'Chủ nhiệm';
}

/** Ban lãnh đạo: Chủ nhiệm + Phó Chủ nhiệm */
export function isLeadership(a?: Actor | null): boolean {
  return !!a && LEADERSHIP_ROLES.includes(a.role);
}

/** Trưởng ban / Phó ban */
export function isDeptManager(a?: Actor | null): boolean {
  return !!a && DEPT_MANAGER_ROLES.includes(a.role);
}

/** Có quyền quản lý công việc của ban này không (lãnh đạo: mọi ban; Trưởng/Phó ban: ban mình) */
export function managesDepartment(a: Actor, department: string): boolean {
  if (isLeadership(a)) return true;
  return isDeptManager(a) && a.department === department;
}

// ----- Công việc -----

/** Toàn bộ người phụ trách của một việc (phụ trách chính + đồng phụ trách), không trùng */
export function taskAssigneeIds(task: TaskRef): string[] {
  let raw: unknown = task.assigneeIds;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  const extra = Array.isArray(raw)
    ? raw.map((item: any) => (typeof item === 'object' && item !== null && item.id ? String(item.id) : String(item)))
    : [];
  return Array.from(new Set([task.assigneeId, ...extra].filter(Boolean)));
}

export function isAssignee(a: Actor, task: TaskRef): boolean {
  return taskAssigneeIds(task).includes(a.id);
}

/**
 * Xem việc:
 *   Ban lãnh đạo:        tất cả
 *   Trưởng/Phó ban:      mọi việc của ban mình + việc được giao cho mình
 *   Thành viên, Cố vấn:  chỉ việc được giao cho mình (kể cả việc nhóm có tên mình)
 */
export function canViewTask(a: Actor, task: TaskRef): boolean {
  if (isLeadership(a) || isAssignee(a, task)) return true;
  return isDeptManager(a) && task.department === a.department;
}

export function canCreateTask(a: Actor): boolean {
  return isLeadership(a) || isDeptManager(a);
}

export function canCreateTaskIn(a: Actor, department: string): boolean {
  return managesDepartment(a, department);
}

export function canEditTask(a: Actor, task: TaskRef): boolean {
  return managesDepartment(a, task.department);
}

export function canDeleteTask(a: Actor): boolean {
  return isPresident(a);
}

/** Nộp minh chứng / xin cập nhật minh chứng: chỉ người được giao */
export function canSubmitEvidence(a: Actor, task: TaskRef): boolean {
  return isAssignee(a, task);
}

/** Duyệt / trả lại minh chứng, phản hồi yêu cầu cập nhật: người quản lý việc đó, nhưng không tự duyệt việc của mình */
export function canReviewTask(a: Actor, task: TaskRef): boolean {
  if (isPresident(a)) return true;
  return managesDepartment(a, task.department) && !isAssignee(a, task);
}

export function canRemindTask(a: Actor, task: TaskRef): boolean {
  return managesDepartment(a, task.department);
}

// ----- Kỳ họp & tài liệu -----

export function canPublishMeeting(a: Actor): boolean {
  return isLeadership(a) || isDeptManager(a);
}

export function canViewMeeting(a: Actor, meeting: { department: string }): boolean {
  return isLeadership(a) || meeting.department === COMMON_DEPARTMENT || meeting.department === a.department;
}

export function canViewDoc(a: Actor, doc: { department: string }): boolean {
  return isLeadership(a) || doc.department === COMMON_DEPARTMENT || doc.department === a.department;
}

export function canWriteDocs(a: Actor): boolean {
  return isLeadership(a) || isDeptManager(a);
}

export function canEditDoc(a: Actor, doc: { department: string }): boolean {
  return managesDepartment(a, doc.department);
}

export function canPinDoc(a: Actor): boolean {
  return isLeadership(a);
}

// ----- Danh bạ thành viên -----

/** Xem thông tin riêng (SĐT, MSV, lớp, ngày sinh): chính mình, Ban lãnh đạo, Trưởng/Phó ban của ban đó */
export function canViewMemberPrivate(a: Actor, m: MemberRef): boolean {
  if (a.id === m.id || isLeadership(a)) return true;
  return isDeptManager(a) && a.department === m.department;
}

/** Mở màn hình quản lý danh sách thành viên (thêm/sửa) */
export function canManageRoster(a: Actor): boolean {
  return isLeadership(a);
}

/**
 * Thêm/sửa một thành viên. Phó Chủ nhiệm không được đụng tới vai trò lãnh đạo:
 * không sửa hồ sơ Chủ nhiệm/Phó Chủ nhiệm, không bổ nhiệm ai vào hai vai trò đó (tránh tự nâng quyền).
 */
export function canEditMember(a: Actor, target: { role: string } | null, newRole?: string): boolean {
  if (isPresident(a)) return true;
  if (!isLeadership(a)) return false;
  if (target && LEADERSHIP_ROLES.includes(target.role)) return false;
  if (newRole && LEADERSHIP_ROLES.includes(newRole)) return false;
  return true;
}

export function canDeleteMember(a: Actor): boolean {
  return isPresident(a);
}

export function canResetMemberPassword(a: Actor): boolean {
  return isPresident(a);
}

// ----- Quản trị hệ thống -----

/** Nhiệm kỳ + import danh bạ Excel (import đổi nhiệm kỳ hiện hành) */
export function canManageTerms(a: Actor): boolean {
  return isPresident(a);
}

export function canManageSettings(a: Actor): boolean {
  return isPresident(a);
}

/** Reset demo / import đè toàn bộ dữ liệu (ngoài ra còn cần cờ ALLOW_DESTRUCTIVE_ADMIN ở server) */
export function canDestructiveAdmin(a: Actor): boolean {
  return isPresident(a);
}

// ----- Nhắc việc quá hạn & Báo cáo tuần -----
//   Ban lãnh đạo:   Báo cáo tuần + Nhắc việc + Nhật ký (toàn CLB)
//   Trưởng/Phó ban: Nhắc việc + Nhật ký (chỉ ban mình)
//   Thành viên:     không có

/** Mở được hộp "Nhắc việc quá hạn" */
export function canUseNag(a: Actor): boolean {
  return isLeadership(a) || isDeptManager(a);
}

/** Báo cáo tuần toàn CLB (xem + gửi) */
export function canViewWeeklyReport(a: Actor): boolean {
  return isLeadership(a);
}

/** Đọc nhật ký nhắc việc: lãnh đạo toàn CLB, Trưởng/Phó ban trong phạm vi ban mình (xem logDepartmentScope) */
export function canViewLogs(a: Actor): boolean {
  return isLeadership(a) || isDeptManager(a);
}

/** null = xem nhật ký mọi ban; còn lại = chỉ nhật ký của ban này */
export function logDepartmentScope(a: Actor): string | null {
  return isLeadership(a) ? null : a.department;
}

/** Ghi nhật ký tự do (Báo cáo tuần). Nhắc việc từng nhiệm vụ đi qua /tasks/:id/remind và tự ghi nhật ký. */
export function canWriteLogs(a: Actor): boolean {
  return isLeadership(a);
}

export function canScanDeadlines(a: Actor): boolean {
  return isLeadership(a) || isDeptManager(a);
}

// ----- Tóm tắt quyền cho giao diện -----

export interface Capabilities {
  /** 'all' = toàn CLB, 'department' = ban mình */
  scope: 'all' | 'department';
  createTask: boolean;
  deleteTask: boolean;
  publishMeeting: boolean;
  writeDocs: boolean;
  pinDocs: boolean;
  manageRoster: boolean;
  deleteMember: boolean;
  resetMemberPassword: boolean;
  manageTerms: boolean;
  manageSettings: boolean;
  destructiveAdmin: boolean;
  viewLogs: boolean;
  nag: boolean;
  weeklyReport: boolean;
}

export function capabilitiesOf(a: Actor): Capabilities {
  return {
    scope: isLeadership(a) ? 'all' : 'department',
    createTask: canCreateTask(a),
    deleteTask: canDeleteTask(a),
    publishMeeting: canPublishMeeting(a),
    writeDocs: canWriteDocs(a),
    pinDocs: canPinDoc(a),
    manageRoster: canManageRoster(a),
    deleteMember: canDeleteMember(a),
    resetMemberPassword: canResetMemberPassword(a),
    manageTerms: canManageTerms(a),
    manageSettings: canManageSettings(a),
    destructiveAdmin: canDestructiveAdmin(a),
    viewLogs: canViewLogs(a),
    nag: canUseNag(a),
    weeklyReport: canViewWeeklyReport(a),
  };
}
