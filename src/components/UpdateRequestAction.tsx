import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Task } from '../types';

interface UpdateRequestActionProps {
  task: Task;
  /** Người đang xem là người được giao việc */
  isAssignee: boolean;
  /** Người đang xem có quyền duyệt việc này (shared/permissions → canReviewTask) */
  canReview: boolean;
  onUpdateRequest?: (task: Task) => void;
  compact?: boolean;
}

/**
 * Nút "Xin sửa minh chứng" cho người được giao — chỉ có khi minh chứng đang chờ duyệt:
 *  - Chưa gửi yêu cầu: nút "Xin sửa minh chứng"
 *  - Đã gửi: nhãn "Đã xin sửa" (người duyệt thấy lý do trong hộp "Kiểm tra")
 */
export const UpdateRequestAction: React.FC<UpdateRequestActionProps> = ({
  task,
  isAssignee,
  canReview,
  onUpdateRequest,
  compact = false,
}) => {
  if (task.status !== 'pending_approval' || !onUpdateRequest) return null;
  const size = compact ? 'h-8 px-2.5 text-[13px] rounded-lg' : 'h-9 px-3 text-[13px] rounded-lg';
  const icon = 'size-3.5';
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateRequest(task);
  };

  // Người duyệt xử lý yêu cầu sửa ngay trong hộp "Kiểm tra" (nút "Yêu cầu cập nhật" trả việc về để nộp lại),
  // nên ở đây chỉ còn phần của người làm.
  if (isAssignee && !canReview) {
    if (task.updateRequestedAt) {
      return (
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[12px] font-medium text-warning"
          title="Đã gửi yêu cầu sửa minh chứng — chờ người duyệt phản hồi"
        >
          <RotateCcw className={icon} />
          <span>Đã xin sửa</span>
        </span>
      );
    }
    return (
      <button
        onClick={open}
        className={`${size} inline-flex shrink-0 items-center gap-1.5 font-medium transition cursor-pointer border border-border-strong bg-surface text-fg-2 hover:bg-surface-2 hover:text-fg`}
        title="Minh chứng đã nộp cần sửa? Gửi yêu cầu để người duyệt cho phép nộp lại"
      >
        <RotateCcw className={icon} />
        <span>Xin sửa minh chứng</span>
      </button>
    );
  }

  return null;
};
