import React from 'react';
import {
  Pin,
  Clock,
  Calendar,
  User,
  Users,
  Bell,
  Link as LinkIcon,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit2,
  Trash2,
  Send,
  FileText,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { Department, Role, Task, Member } from '../types';
import { canReviewTask } from '../../shared/permissions';
import { UpdateRequestAction } from './UpdateRequestAction';
import { AssigneeLine, DeptLabel, DueText, StatusChip, btnPrimarySm, btnRemindSm, btnSoftSm, iconBtnSm } from './taskUi';

interface TaskCardProps {
  task: Task;
  currentRole: Role;
  currentDepartment: Department;
  currentUserId: string;
  members: Member[];
  onOpenDetail: (task: Task) => void;
  onOpenSubmitModal: (task: Task) => void;
  onOpenReviewModal: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onQuickApprove?: (taskId: string) => void;
  onUpdateRequest: (task: Task) => void;
  onRemindTask?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  currentRole,
  currentDepartment,
  currentUserId,
  members,
  onOpenDetail,
  onOpenSubmitModal,
  onOpenReviewModal,
  onDeleteTask,
  onQuickApprove,
  onUpdateRequest,
  onRemindTask,
}) => {
  const isPresident = currentRole === 'Chủ nhiệm';
  const isVicePresident = currentRole === 'Phó Chủ nhiệm';
  const isLeadership = isPresident || isVicePresident;
  const isDeptHead =
    (currentRole === 'Trưởng ban' || currentRole === 'Phó ban') && currentDepartment === task.department;
  const isManager = isLeadership || isDeptHead;

  // Lấy danh sách ID của tất cả người phụ trách
  const assigneeIdList: string[] = React.useMemo(() => {
    let ids: string[] = [];
    if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
      ids = task.assigneeIds.map((item: any) =>
        typeof item === 'object' && item !== null && item.id ? String(item.id) : String(item)
      );
    } else if (task.assigneeId) {
      ids = [task.assigneeId];
    }
    return Array.from(new Set(ids.filter(Boolean)));
  }, [task.assigneeIds, task.assigneeId]);

  // Kiểm tra người dùng hiện tại có phải là người phụ trách việc này không
  const isAssignee = assigneeIdList.includes(currentUserId);

  // Danh sách tên của tất cả người phụ trách (hiển thị đầy đủ, không ẩn)
  const allAssigneeNames: string[] = React.useMemo(() => {
    const names = assigneeIdList
      .map((id) => members.find((m) => m.id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length === 0 && task.assigneeName) {
      return [task.assigneeName];
    }
    return names;
  }, [assigneeIdList, members, task.assigneeName]);

  // Quyền:
  // 1. Nộp minh chứng: Người được giao việc (hoặc Chủ nhiệm hỗ trợ)
  const canSubmit = isAssignee;

  // 2. Nhắc nộp: Ban quản lý (Chủ nhiệm/Phó Chủ nhiệm hoặc Trưởng/Phó ban cùng ban) khi không phải là người trực tiếp làm
  const canRemind = isManager && !isAssignee;

  // 3. Kiểm tra minh chứng (khi chờ duyệt): Ban quản lý
  // Duyệt minh chứng: cùng quy tắc với server (shared/permissions) — người quản lý việc, không tự duyệt việc của mình
  const canReview = canReviewTask({ id: currentUserId, role: currentRole, department: currentDepartment }, task);

  const isDone = task.status === 'completed';

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition ${
        isDone ? 'border-border bg-surface-2/70' : 'border-border bg-surface hover:border-border-strong'
      }`}
    >
      {/* Ban · trạng thái */}
      <div className="flex items-center justify-between gap-2">
        <DeptLabel department={task.department} />
        <StatusChip status={task.status} />
      </div>

      {/* Tên việc — bấm để xem chi tiết */}
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onOpenDetail(task)}
          title={task.title}
          className={`block w-full text-left text-[14px] font-semibold leading-snug line-clamp-2 transition hover:text-primary cursor-pointer ${
            isDone ? 'text-muted line-through' : 'text-fg'
          }`}
        >
          {task.title}
        </button>
        {task.description && (
          <p className="mt-1 line-clamp-1 text-[12px] text-muted" title={task.description}>
            {task.description}
          </p>
        )}
      </div>

      {/* Người phụ trách · hạn chót · loại minh chứng */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <AssigneeLine names={allAssigneeNames} />
          {task.status === 'pending_approval' && !canReview && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-warning">
              <Clock className="size-3.5" />
              Đang chờ duyệt
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <DueText deadline={task.deadline} status={task.status} />
          <span className="inline-flex items-center gap-1 text-[12px] text-muted">
            {task.verificationType === 'link_required' ? (
              <>
                <LinkIcon className="size-3.5" />
                Nộp link
              </>
            ) : (
              <>
                <FileCheck className="size-3.5" />
                Nộp báo cáo
              </>
            )}
          </span>
        </div>
      </div>

      {/* Minh chứng đã nộp */}
      {(task.evidenceLink || task.evidenceReport) && (
        <div className="space-y-1 rounded-xl bg-surface-2 px-3 py-2.5 text-[12px] ring-1 ring-border">
          <p className="font-medium text-fg-2">Minh chứng đã nộp</p>
          {task.evidenceLink && (
            <a
              href={task.evidenceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1 font-medium text-primary hover:underline"
            >
              <LinkIcon className="size-3 shrink-0" />
              <span className="truncate">{task.evidenceLink}</span>
            </a>
          )}
          {task.evidenceReport && <p className="line-clamp-2 text-fg-2">“{task.evidenceReport}”</p>}
          {task.approvalNote && (
            <p className="flex items-center gap-1 border-t border-border pt-1 font-medium text-success">
              <CheckCircle2 className="size-3 shrink-0" />
              <span>{task.approvalNote}</span>
            </p>
          )}
          {task.rejectedReason && task.status !== 'completed' && (
            <p className="flex items-center gap-1 border-t border-border pt-1 font-medium text-danger">
              <AlertCircle className="size-3 shrink-0" />
              <span>Yêu cầu sửa: {task.rejectedReason}</span>
            </p>
          )}
        </div>
      )}

      {/* Phản hồi yêu cầu cập nhật từ Ban điều hành */}
      {task.updateFeedback && (
        <div className="rounded-xl bg-warning-bg px-3 py-2 text-[12px] ring-1 ring-warning-bar/25">
          <p className="mb-0.5 flex items-center gap-1 font-medium text-warning">
            <FileText className="size-3" /> Phản hồi của Ban điều hành
          </p>
          <p className="text-fg-2">{task.updateFeedback}</p>
        </div>
      )}

      {/* Nguồn · thao tác */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="min-w-0 truncate text-[11px] text-muted" title={task.sourceMeetingTitle}>
          {task.sourceMeetingTitle || 'Biên bản NITC'}
        </span>

        <div className="flex shrink-0 items-center justify-end gap-1">
          {/* 1. Nộp (chỉ dành cho người được giao việc) */}
          {canSubmit && task.status !== 'completed' && task.status !== 'pending_approval' && (
            <button type="button" onClick={() => onOpenSubmitModal(task)} className={btnPrimarySm} title="Nộp link URL hoặc báo cáo kết quả">
              <Send className="size-3.5" />
              Nộp
            </button>
          )}

          {/* 2. Nhắc nộp (Ban quản lý khi việc chưa xong và không phải người làm) */}
          {canRemind && (task.status === 'in_progress' || task.status === 'overdue') && onRemindTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemindTask(task);
              }}
              className={btnRemindSm}
              title="Gửi thông báo nhắc nộp minh chứng đến người phụ trách"
            >
              <Bell className="size-3.5" />
              Nhắc nộp
            </button>
          )}

          {/* 3. Kiểm tra (khi đang chờ duyệt: Ban quản lý) */}
          {task.status === 'pending_approval' && canReview && (
            <button type="button" onClick={() => onOpenReviewModal(task)} className={btnSoftSm} title="Kiểm tra minh chứng: duyệt hoặc yêu cầu sửa">
              <ShieldCheck className="size-3.5" />
              Kiểm tra
            </button>
          )}

          {/* 3b. Xin sửa minh chứng (người làm) */}
          <UpdateRequestAction task={task} isAssignee={isAssignee} canReview={canReview} onUpdateRequest={onUpdateRequest} compact />

          {/* Chủ nhiệm: duyệt nhanh việc đang làm */}
          {isPresident && task.status !== 'completed' && task.status !== 'pending_approval' && onQuickApprove && (
            <button
              type="button"
              onClick={() => onQuickApprove(task.id)}
              className={`${iconBtnSm} hover:text-success`}
              title="Duyệt nhanh hoàn thành"
              aria-label="Duyệt nhanh hoàn thành"
            >
              <CheckCircle2 className="size-4" />
            </button>
          )}

          {/* Chủ nhiệm: xoá việc */}
          {isPresident && (
            <button
              type="button"
              onClick={() => onDeleteTask(task.id)}
              className={`${iconBtnSm} hover:text-danger`}
              title="Xóa nhiệm vụ"
              aria-label="Xóa nhiệm vụ"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
