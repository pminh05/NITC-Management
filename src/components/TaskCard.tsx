import React from 'react';
import {
  Pin,
  Clock,
  Calendar,
  User,
  Link as LinkIcon,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit2,
  Trash2,
  Send,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { Department, Role, Task } from '../types';
import { formatDateVN, getDaysRemaining } from '../utils/dateUtils';

interface TaskCardProps {
  task: Task;
  currentRole: Role;
  currentDepartment: Department;
  currentUserId: string;
  onOpenSubmitModal: (task: Task) => void;
  onOpenReviewModal: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onQuickApprove?: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  currentRole,
  currentDepartment,
  currentUserId,
  onOpenSubmitModal,
  onOpenReviewModal,
  onDeleteTask,
  onQuickApprove,
}) => {
  const daysInfo = getDaysRemaining(task.deadline);
  const isPresident = currentRole === 'Chủ tịch';
  
  // Can this user submit evidence?
  // President can submit or test, or if user is the assigned department / person
  const canSubmit = isPresident || currentDepartment === task.department || currentUserId === task.assigneeId;

  const departmentColorMap: Record<Department, string> = {
    'Học thuật': 'bg-sky-50 text-sky-700 border-sky-200',
    'Truyền thông': 'bg-pink-50 text-pink-700 border-pink-200',
    'Sự kiện': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Đối ngoại': 'bg-purple-50 text-purple-700 border-purple-200',
    'Ban Chủ nhiệm': 'bg-amber-50 text-amber-800 border-amber-200',
  };

  const statusBadgeMap = {
    draft: { label: 'Bản nháp', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    in_progress: { label: 'Đang làm', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    pending_approval: { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-800 border-amber-300 font-bold' },
    completed: { label: 'Đã hoàn thành', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    overdue: { label: 'Quá hạn 🚨', color: 'bg-red-100 text-red-700 border-red-300 font-bold' },
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-150 flex flex-col justify-between relative shadow-sm ${
        task.status === 'completed'
          ? 'bg-slate-50/70 border-slate-200 opacity-85'
          : task.status === 'overdue'
          ? 'bg-white border-slate-200 border-l-4 border-l-red-500 shadow-sm'
          : task.status === 'pending_approval'
          ? 'bg-white border-slate-200 border-l-4 border-l-amber-500 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow'
      }`}
    >
      <div>
        {/* Top Badges Strip */}
        <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Department Badge */}
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                departmentColorMap[task.department] || 'bg-slate-100 text-slate-700'
              }`}
            >
              {task.department}
            </span>

            {/* Sticky Task Rule Indicator */}
            {task.isSticky && task.status !== 'completed' && (
              <span
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1"
                title="Quy tắc Sticky: Công việc chưa xong từ kỳ họp trước tự động chuyển sang tuần này"
              >
                <Pin className="w-3 h-3 rotate-45 text-purple-600" />
                <span>Nhiệm vụ lưu chuyển</span>
              </span>
            )}
          </div>

          {/* Status Badge */}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              statusBadgeMap[task.status]?.color || 'bg-slate-100 text-slate-700'
            }`}
          >
            {statusBadgeMap[task.status]?.label || task.status}
          </span>
        </div>

        {/* Task Title */}
        <h4
          className={`font-semibold text-sm leading-snug mb-2 ${
            task.status === 'completed'
              ? 'text-slate-400 line-through'
              : 'text-slate-900'
          }`}
        >
          {task.title}
        </h4>

        {/* Task Description if any */}
        {task.description && (
          <p className="text-xs text-slate-600 mb-3 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Assignee & Deadline row */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 mb-3 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
          <div className="flex items-center gap-1.5 truncate">
            <User className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="truncate font-semibold text-slate-800" title={task.assigneeName}>
              {task.assigneeName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 justify-end">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono text-slate-700 font-medium">
              {formatDateVN(task.deadline)}
            </span>
          </div>
        </div>

        {/* Verification type & Deadline Countdown */}
        <div className="flex items-center justify-between text-xs mb-3 gap-2 flex-wrap">
          {/* Verification requirement */}
          <div className="flex items-center gap-1 text-[11px] font-medium">
            {task.verificationType === 'link_required' ? (
              <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                <LinkIcon className="w-3 h-3" />
                <span>Yêu cầu Link URL</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-semibold">
                <FileCheck className="w-3 h-3" />
                <span>Yêu cầu Báo cáo 2 câu</span>
              </span>
            )}
          </div>

          {/* Days remaining badge */}
          {task.status !== 'completed' && (
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${daysInfo.badgeColor}`}
            >
              {daysInfo.label}
            </span>
          )}
        </div>

        {/* Submitted Evidence Preview if exists */}
        {(task.evidenceLink || task.evidenceReport) && (
          <div className="mb-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Minh chứng đã nộp:</span>
              {task.status === 'pending_approval' && (
                <span className="text-amber-700 font-bold">Chờ Chủ tịch duyệt</span>
              )}
            </div>

            {task.evidenceLink && (
              <a
                href={task.evidenceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-600 hover:text-orange-700 underline truncate block flex items-center gap-1 font-medium"
              >
                <LinkIcon className="w-3 h-3 shrink-0" />
                <span className="truncate">{task.evidenceLink}</span>
              </a>
            )}

            {task.evidenceReport && (
              <p className="text-slate-700 italic text-[11px] line-clamp-2">
                "{task.evidenceReport}"
              </p>
            )}

            {task.approvalNote && (
              <p className="text-emerald-700 font-medium text-[11px] pt-1 border-t border-slate-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                <span>{task.approvalNote}</span>
              </p>
            )}

            {task.rejectedReason && task.status !== 'completed' && (
              <p className="text-red-700 font-medium text-[11px] pt-1 border-t border-slate-200 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0 text-red-500" />
                <span>Yêu cầu sửa: {task.rejectedReason}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Card Action Controls */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-1">
        {/* Source meeting info */}
        <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={task.sourceMeetingTitle}>
          {task.sourceMeetingTitle || 'Biên bản NITC'}
        </span>

        <div className="flex items-center gap-1.5">
          {/* Trưởng ban / Assignee Submit Action */}
          {canSubmit && task.status !== 'completed' && (
            <button
              onClick={() => onOpenSubmitModal(task)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                task.status === 'pending_approval'
                  ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>{task.status === 'pending_approval' ? 'Cập nhật' : 'Nộp bài'}</span>
            </button>
          )}

          {/* Chủ tịch Review / Approve Action */}
          {isPresident && task.status === 'pending_approval' && (
            <button
              onClick={() => onOpenReviewModal(task)}
              className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Duyệt minh chứng</span>
            </button>
          )}

          {/* President quick approve for tasks in progress */}
          {isPresident && task.status !== 'completed' && task.status !== 'pending_approval' && onQuickApprove && (
            <button
              onClick={() => onQuickApprove(task.id)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 border border-slate-200 transition cursor-pointer"
              title="Duyệt nhanh hoàn thành"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Task button (President only) */}
          {isPresident && (
            <button
              onClick={() => onDeleteTask(task.id)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 border border-slate-200 transition cursor-pointer"
              title="Xóa nhiệm vụ"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
