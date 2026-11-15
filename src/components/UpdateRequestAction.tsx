import React from 'react';
import { MessageSquareReply, RotateCcw } from 'lucide-react';
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
 * Nút của luồng "Yêu cầu cập nhật minh chứng" — chỉ có khi minh chứng đang chờ duyệt:
 *  - Người được giao, chưa gửi yêu cầu: "Xin sửa minh chứng"
 *  - Người được giao, đã gửi: nhãn "Đã xin sửa" (chờ người duyệt phản hồi)
 *  - Người có quyền duyệt, đang có yêu cầu: "Phản hồi yêu cầu sửa"
 */
export const UpdateRequestAction: React.FC<UpdateRequestActionProps> = ({
  task,
  isAssignee,
  canReview,
  onUpdateRequest,
  compact = false,
}) => {
  if (task.status !== 'pending_approval' || !onUpdateRequest) return null;
  const size = compact ? 'px-2 py-0.5 text-[11px] rounded-md' : 'px-3 py-1.5 text-xs rounded-lg';
  const icon = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateRequest(task);
  };

  if (task.updateRequestedAt && canReview) {
    return (
      <button
        onClick={open}
        className={`${size} font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer bg-violet-600 hover:bg-violet-500 text-white shadow-sm`}
        title={`Người làm xin sửa minh chứng${task.updateRequestNote ? `: ${task.updateRequestNote}` : ''}`}
      >
        <MessageSquareReply className={icon} />
        <span>Phản hồi yêu cầu sửa</span>
      </button>
    );
  }

  if (isAssignee && !canReview) {
    if (task.updateRequestedAt) {
      return (
        <span
          className={`${compact ? 'px-1.5 py-0.5 text-[10px] rounded' : 'px-2.5 py-1 text-xs rounded-lg'} font-semibold flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700`}
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
        className={`${size} font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer bg-white hover:bg-violet-50 text-violet-700 border border-violet-300 dark:bg-slate-900 dark:hover:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700`}
        title="Minh chứng đã nộp cần sửa? Gửi yêu cầu để người duyệt cho phép nộp lại"
      >
        <RotateCcw className={icon} />
        <span>Xin sửa minh chứng</span>
      </button>
    );
  }

  return null;
};
