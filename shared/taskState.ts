// MÁY TRẠNG THÁI CÔNG VIỆC — nguồn duy nhất, dùng chung server và giao diện.
//
//   đang làm ──nộp minh chứng──▶ chờ duyệt ──duyệt──▶ hoàn thành
//      ▲                            │
//      └──────── trả lại ───────────┘
//      └── cho phép cập nhật minh chứng (phản hồi yêu cầu cập nhật) ──┘
//
// "Quá hạn" KHÔNG phải trạng thái lưu trong CSDL: đó là việc "đang làm" mà hạn chót đã qua,
// tính theo ngày Việt Nam tại thời điểm đọc. Nhờ vậy không cần chờ cron chạy mới đúng,
// và gia hạn xong là việc tự hết "quá hạn".
import { todayVN } from './time';

export type TaskStatus = 'in_progress' | 'pending_approval' | 'completed' | 'overdue';
export type TaskAction = 'submit_evidence' | 'approve' | 'reject' | 'request_update' | 'respond_update' | 'update' | 'remind';

/** Trạng thái hiển thị: việc chưa nộp mà trễ hạn → 'overdue'; còn lại giữ nguyên. */
export function effectiveStatus(task: { status: string; deadline: string }, today: string = todayVN()): TaskStatus {
  if (task.status === 'completed' || task.status === 'pending_approval') return task.status;
  return task.deadline < today ? 'overdue' : 'in_progress';
}

/** Việc còn mở cho người làm (đang làm hoặc quá hạn) */
export function isOpenStatus(status: string): boolean {
  return status === 'in_progress' || status === 'overdue';
}

/**
 * Hành động có hợp lệ ở trạng thái hiện tại không? Trả null nếu hợp lệ, ngược lại là lý do (tiếng Việt).
 * `allowQuickApprove`: Chủ nhiệm được "duyệt nhanh" việc chưa nộp minh chứng (xác nhận trực tiếp).
 */
export function transitionError(
  action: TaskAction,
  status: string,
  opts: { allowQuickApprove?: boolean } = {}
): string | null {
  const open = isOpenStatus(status);
  const pending = status === 'pending_approval';
  const done = status === 'completed';

  switch (action) {
    case 'submit_evidence':
      if (open) return null;
      return pending
        ? 'Minh chứng đang chờ duyệt. Muốn sửa, hãy gửi yêu cầu cập nhật minh chứng.'
        : 'Việc đã được nghiệm thu hoàn thành, không nộp lại minh chứng được.';
    case 'approve':
      if (pending) return null;
      if (done) return 'Việc này đã được duyệt hoàn thành rồi.';
      return opts.allowQuickApprove ? null : 'Việc chưa có minh chứng chờ duyệt nên chưa thể nghiệm thu.';
    case 'reject':
      return pending ? null : 'Chỉ trả lại được khi minh chứng đang chờ duyệt.';
    case 'request_update':
      return pending ? null : 'Chỉ gửi yêu cầu cập nhật khi minh chứng đang chờ duyệt.';
    case 'respond_update':
      return pending ? null : 'Việc không còn ở trạng thái chờ duyệt nên không có yêu cầu cập nhật để phản hồi.';
    case 'remind':
      if (open) return null;
      return pending ? 'Việc đã nộp minh chứng, đang chờ duyệt — không cần nhắc.' : 'Việc đã hoàn thành — không cần nhắc.';
    case 'update':
      return null; // sửa thông tin: xem giới hạn với việc đã hoàn thành ở COMPLETED_EDITABLE_FIELDS
    default:
      return 'Hành động không hợp lệ.';
  }
}

/** Việc đã hoàn thành chỉ còn sửa được các trường mô tả — không đổi hạn, người làm, ban (ảnh hưởng điểm KPI). */
export const COMPLETED_EDITABLE_FIELDS = ['title', 'description', 'priority'];
