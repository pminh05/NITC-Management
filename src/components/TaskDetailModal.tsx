import React from 'react';
import { X, User, Users, Calendar, FileText, Link as LinkIcon, CheckCircle2, RotateCcw, FileCheck, Flag, Send, Bell, ShieldCheck } from 'lucide-react';
import { Member, Task, Role, Department } from '../types';
import { canReviewTask } from '../../shared/permissions';
import { formatDateVN, formatDateTimeVN, getDaysRemaining } from '../utils/dateUtils';

interface TaskDetailModalProps {
  task: Task | null;
  members: Member[];
  onClose: () => void;
  currentUserId?: string;
  currentRole?: Role;
  currentDepartment?: Department;
  onOpenSubmitModal?: (task: Task) => void;
  onOpenReviewModal?: (task: Task) => void;
  onRemindTask?: (task: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  members,
  onClose,
  currentUserId,
  currentRole,
  currentDepartment,
  onOpenSubmitModal,
  onOpenReviewModal,
  onRemindTask,
}) => {
  if (!task) return null;

  // Danh sách TẤT CẢ người phụ trách (assigneeIds, fallback 1 người)
  let assigneeIds: string[] = [task.assigneeId];
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
    assigneeIds = task.assigneeIds.map((item: any) =>
      typeof item === 'object' && item !== null && item.id ? String(item.id) : String(item)
    );
  }
  const assignees = assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as Member[];

  const isPresident = currentRole === 'Chủ nhiệm';
  const isVicePresident = currentRole === 'Phó Chủ nhiệm';
  const isLeadership = isPresident || isVicePresident;
  const isDeptHead =
    (currentRole === 'Trưởng ban' || currentRole === 'Phó ban') && currentDepartment === task.department;
  const isManager = isLeadership || isDeptHead;
  const isAssignee = currentUserId ? assigneeIds.includes(currentUserId) : false;

  const canSubmit = isAssignee;
  const canRemind = isManager && !isAssignee;
  const canReview = canReviewTask({ id: currentUserId || '', role: currentRole, department: currentDepartment }, task);

  const days = getDaysRemaining(task.deadline);
  const meta = TYPE_META(task);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-[#101828]/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="bg-surface border-t sm:border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-200 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1 bg-[#EAECF0] rounded-full mx-auto my-2.5 shrink-0" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-surface-2 text-fg-2 text-[10px] font-semibold">
                Ban {task.department}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${meta.badge}`}>
                {meta.label}
              </span>
            </div>
            <h2 className="text-base font-bold text-fg leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">

          {/* Mô tả */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Mô tả công việc
            </div>
            <p className="text-fg leading-relaxed">
              {task.description || 'Không có mô tả.'}
            </p>
          </div>

          {/* Người phụ trách — TẤT CẢ */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
              {assignees.length > 1 ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
              Người phụ trách ({assignees.length})
            </div>
            <div className="space-y-1.5">
              {assignees.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2 border border-border">
                  <span className="w-6 h-6 rounded-full bg-[#F2F4F7] flex items-center justify-center text-[10px] font-bold text-fg shrink-0">
                    {m.name.charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-fg font-semibold truncate">
                      {m.name}
                      {i === 0 && assignees.length > 1 && (
                        <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-warning-bg text-warning font-bold">chính</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted">
                      {m.role} · Ban {m.department}
                    </div>
                  </div>
                </div>
              ))}
              {assignees.length === 0 && (
                <div className="text-muted p-2">Người phụ trách không còn trong danh sách.</div>
              )}
            </div>
          </div>

          {/* Hạn chót + loại xác minh */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
              <div className="text-[10px] font-bold text-muted uppercase mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Hạn chót
              </div>
              <div className="text-fg font-bold">{formatDateVN(task.deadline)}</div>
              {task.status !== 'completed' && (
                <div className={`text-[10px] mt-0.5 font-semibold ${days.isOverdue ? 'text-danger' : days.isToday ? 'text-warning' : 'text-muted'}`}>
                  {days.label}
                </div>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
              <div className="text-[10px] font-bold text-muted uppercase mb-1 flex items-center gap-1">
                <FileCheck className="w-3 h-3" /> Xác minh
              </div>
              <div className="text-fg font-bold">
                {task.verificationType === 'link_required' ? 'Cần Link sản phẩm' : 'Báo cáo 2 câu'}
              </div>
            </div>
          </div>

          {/* Minh chứng */}
          {(task.evidenceLink || task.evidenceReport) && (
            <div>
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                Minh chứng đã nộp {task.evidenceSubmittedAt ? `(${formatDateTimeVN(task.evidenceSubmittedAt)})` : ''}
              </div>
              {task.evidenceLink && (
                <a
                  href={task.evidenceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 p-2 rounded-lg bg-primary-light border border-primary/30 text-primary break-all hover:bg-primary-light transition"
                >
                  <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                  {task.evidenceLink}
                </a>
              )}
              {task.evidenceReport && (
                <p className="p-2 rounded-lg bg-surface-2 border border-border text-fg leading-relaxed">
                  "{task.evidenceReport}"
                </p>
              )}
            </div>
          )}

          {/* Yêu cầu cập nhật đang chờ / feedback */}
          {task.updateRequestedAt && !task.updateFeedback && (
            <div className="p-2.5 rounded-lg bg-primary-light border border-primary/30">
              <div className="text-primary font-bold text-xs mb-1">⏳ Yêu cầu cập nhật đang chờ phản hồi</div>
              {task.updateRequestNote && <div className="text-fg-2">Ghi chú: {task.updateRequestNote}</div>}
              <div className="text-[10px] text-muted mt-1">Gửi {formatDateVN(task.updateRequestedAt)}</div>
            </div>
          )}
          {task.updateFeedback && (
            <div className="p-2.5 rounded-lg bg-warning-bg border border-warning-bar/30">
              <div className="text-warning font-bold text-xs mb-1">🔄 Phản hồi yêu cầu cập nhật</div>
              <div className="text-fg-2">{task.updateFeedback}</div>
            </div>
          )}

          {/* Kết quả duyệt */}
          {task.approvalNote && (
            <div className="p-2.5 rounded-lg bg-success-bg border border-success-bar/30 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <div>
                <div className="text-success font-bold">Lời phê duyệt</div>
                <div className="text-fg-2">{task.approvalNote}</div>
              </div>
            </div>
          )}
          {task.rejectedReason && (
            <div className="p-2.5 rounded-lg bg-danger-bg border border-danger-bar/30 flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div>
                <div className="text-danger font-bold">Lý do bị trả lại</div>
                <div className="text-fg-2">{task.rejectedReason}</div>
              </div>
            </div>
          )}

          {/* Nguồn + thời gian */}
          <div className="text-[10px] text-muted space-y-0.5 border-t border-border pt-3">
            {task.sourceMeetingTitle && (
              <div className="flex items-center gap-1">
                <Flag className="w-3 h-3" /> Nguồn: {task.sourceMeetingTitle}
              </div>
            )}
            <div>Tạo: {formatDateTimeVN(task.createdAt)} · Cập nhật: {formatDateTimeVN(task.updatedAt)}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-surface flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {canSubmit && task.status !== 'completed' && task.status !== 'pending_approval' && onOpenSubmitModal && (
              <button
                onClick={() => onOpenSubmitModal(task)}
                className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Nộp minh chứng</span>
              </button>
            )}

            {canRemind && (task.status === 'in_progress' || task.status === 'overdue') && onRemindTask && (
              <button
                onClick={() => onRemindTask(task)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition cursor-pointer border border-warning-bar/40 bg-warning-bg text-warning hover:bg-[#FEF0C7] hover:border-warning-bar/60"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Nhắc nộp việc này</span>
              </button>
            )}

            {task.status === 'pending_approval' && canReview && onOpenReviewModal && (
              <button
                onClick={() => onOpenReviewModal(task)}
                className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Kiểm tra minh chứng</span>
              </button>
            )}
          </div>

          <button onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-fg-2 transition hover:bg-surface-2 hover:text-fg cursor-pointer">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

function TYPE_META(task: Task): { label: string; badge: string } {
  switch (task.status) {
    case 'completed':
      return { label: 'Đã hoàn thành', badge: 'bg-success-bg text-success border border-success-bar/30' };
    case 'pending_approval':
      return { label: 'Chờ duyệt minh chứng', badge: 'bg-warning-bg text-warning border border-warning-bar/30' };
    case 'overdue':
      return { label: 'Quá hạn', badge: 'bg-danger-bg text-danger border border-danger-bar/30' };
    default: {
      const days = getDaysRemaining(task.deadline);
      return {
        label: days.isOverdue ? 'Trễ hạn' : 'Đang thực hiện',
        badge: days.isOverdue ? 'bg-danger-bg text-danger border border-danger-bar/30' : 'bg-info-bg text-info border border-info-bar/30',
      };
    }
  }
}
