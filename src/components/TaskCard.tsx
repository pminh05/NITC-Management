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
import { formatDateVN, getDaysRemaining, isTaskOverdue } from '../utils/dateUtils';

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
  const daysInfo = getDaysRemaining(task.deadline);
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

  const departmentColorMap: Record<Department, string> = {
    'Học thuật': 'bg-sky-50 text-sky-700 border-sky-200',
    'Truyền thông': 'bg-pink-50 text-pink-700 border-pink-200',
    'Sự kiện': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Đối ngoại': 'bg-purple-50 text-purple-700 border-purple-200',
    'Ban Chủ nhiệm': 'bg-amber-50 text-amber-800 border-amber-200',
  };

  const statusBadgeMap = {
    draft: { label: 'Bản nháp', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200' },
    in_progress: { label: 'Đang làm', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    pending_approval: { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-800 border-amber-300 font-bold' },
    completed: { label: 'Đã hoàn thành', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    overdue: { label: 'Quá hạn 🚨', color: 'bg-red-100 text-red-700 border-red-300 font-bold' },
  };

  return (
    <div
      className={`rounded-2xl border p-4.5 sm:p-5 transition-all duration-200 flex flex-col justify-between relative shadow-xs hover:shadow-md ${
        task.status === 'completed'
          ? 'bg-slate-50/70 border-slate-200 dark:border-slate-800 opacity-85'
          : task.status === 'overdue'
          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-l-4 border-l-red-500 shadow-sm'
          : task.status === 'pending_approval'
          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 shadow-sm'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700 hover:shadow'
      }`}
    >
      <div>
        {/* Top Badges Strip */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Department Badge */}
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                departmentColorMap[task.department] || 'bg-slate-100 dark:bg-slate-800 text-slate-700'
              }`}
            >
              {task.department}
            </span>
          </div>

          {/* Status Badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              statusBadgeMap[task.status]?.color || 'bg-slate-100 dark:bg-slate-800 text-slate-700'
            }`}
          >
            {statusBadgeMap[task.status]?.label || task.status}
          </span>
        </div>

        {/* Task Title — bấm để xem chi tiết */}
        <h4
          onClick={() => onOpenDetail(task)}
          title="Bấm để xem chi tiết công việc"
          className={`font-semibold text-sm leading-snug mb-2 cursor-pointer hover:text-[#2C69FF] transition ${
            task.status === 'completed'
              ? 'text-slate-400 line-through'
              : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {task.title}
        </h4>

        {/* Task Description if any */}
        {task.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2.5 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Assignee & Deadline row */}
        <div className="text-[11px] text-slate-700 dark:text-slate-300 mb-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 space-y-1.5">
          {/* Người phụ trách */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              {allAssigneeNames.length > 1 ? (
                <Users className="w-3 h-3 text-[#2C69FF]" />
              ) : (
                <User className="w-3 h-3 text-[#2C69FF]" />
              )}
              <span>Phụ trách ({allAssigneeNames.length}):</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {allAssigneeNames.length > 0 && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[#1F56D6] dark:text-[#8FB2FF] border border-blue-200 dark:border-blue-800/60 text-[11px] font-medium truncate max-w-[200px]"
                  title={allAssigneeNames[0]}
                >
                  {allAssigneeNames[0]}
                </span>
              )}
              {allAssigneeNames.length > 1 && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 text-[#1F56D6] dark:text-[#8FB2FF] border border-blue-300 dark:border-blue-700 text-[10px] font-bold cursor-help transition shadow-2xs shrink-0"
                  title={`Còn lại ${allAssigneeNames.length - 1} người phụ trách:\n• ${allAssigneeNames.slice(1).join('\n• ')}`}
                >
                  +{allAssigneeNames.length - 1}
                </span>
              )}
            </div>
          </div>

          {/* Hạn chót */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Hạn chót:</span>
            </span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
              {formatDateVN(task.deadline)}
            </span>
          </div>
        </div>

        {/* Verification type & Deadline Countdown */}
        <div className="flex items-center justify-between text-xs mb-2.5 gap-2 flex-wrap">
          {/* Verification requirement */}
          <div className="flex items-center gap-1 text-[11px] font-medium">
            {task.verificationType === 'link_required' ? (
              <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-medium text-[11px]">
                <LinkIcon className="w-3 h-3" />
                <span>Yêu cầu Link URL</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-medium text-[11px]">
                <FileCheck className="w-3 h-3" />
                <span>Yêu cầu Báo cáo 2 câu</span>
              </span>
            )}
          </div>

          {/* Days remaining badge */}
          {task.status !== 'completed' && (
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${daysInfo.badgeColor}`}
            >
              <Clock className="w-3 h-3 shrink-0" />
              <span>{daysInfo.label}</span>
            </span>
          )}
        </div>

        {/* Submitted Evidence Preview if exists */}
        {(task.evidenceLink || task.evidenceReport) && (
          <div className="mb-3 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Minh chứng đã nộp:</span>
              {task.status === 'pending_approval' && (
                <span className="text-amber-700 font-bold">Chờ duyệt</span>
              )}
            </div>

            {task.evidenceLink && (
              <a
                href={task.evidenceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1F56D6] hover:text-[#1E4FC4] underline truncate block flex items-center gap-1 font-medium"
              >
                <LinkIcon className="w-3 h-3 shrink-0" />
                <span className="truncate">{task.evidenceLink}</span>
              </a>
            )}

            {task.evidenceReport && (
              <p className="text-slate-700 dark:text-slate-300 italic text-[11px] line-clamp-2">
                "{task.evidenceReport}"
              </p>
            )}

            {task.approvalNote && (
              <p className="text-emerald-700 font-medium text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                <span>{task.approvalNote}</span>
              </p>
            )}

            {task.rejectedReason && task.status !== 'completed' && (
              <p className="text-red-700 font-medium text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0 text-red-500" />
                <span>Yêu cầu sửa: {task.rejectedReason}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Card Action Controls */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-1">
        {/* Source meeting info */}
        <span className="text-[10px] text-slate-400 truncate max-w-[110px]" title={task.sourceMeetingTitle}>
          {task.sourceMeetingTitle || 'Biên bản NITC'}
        </span>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* 1. Nộp (chỉ dành cho người được giao việc) */}
          {canSubmit && task.status !== 'completed' && task.status !== 'pending_approval' && (
            <button
              onClick={() => onOpenSubmitModal(task)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer bg-[#2C69FF] hover:bg-[#1F56D6] text-white shadow-sm"
              title="Nộp link URL hoặc báo cáo kết quả"
            >
              <Send className="w-3 h-3" />
              <span>Nộp</span>
            </button>
          )}

          {/* 2. Nhắc nộp (dành cho Ban quản lý/Lãnh đạo khi task chưa hoàn thành và không phải người làm) */}
          {canRemind && (task.status === 'in_progress' || task.status === 'overdue') && onRemindTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemindTask(task);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm ${
                task.status === 'overdue'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
              title="Gửi thông báo nhắc nộp minh chứng đến người phụ trách"
            >
              <Bell className="w-3 h-3" />
              <span>Nhắc nộp</span>
            </button>
          )}

          {/* 3. Kiểm tra (khi đang chờ duyệt: dành cho Ban quản lý) */}
          {task.status === 'pending_approval' && canReview && (
            <button
              onClick={() => onOpenReviewModal(task)}
              className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/25 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
              title="Kiểm tra minh chứng: duyệt hoặc yêu cầu sửa"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Kiểm tra</span>
            </button>
          )}

          {/* 3b. Xin sửa minh chứng (người làm) / phản hồi yêu cầu sửa (người duyệt) */}
          <UpdateRequestAction task={task} isAssignee={isAssignee} canReview={canReview} onUpdateRequest={onUpdateRequest} />

          {/* 4. Trạng thái chờ duyệt (khi người xem không có quyền duyệt) */}
          {task.status === 'pending_approval' && !canReview && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 text-xs font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Chờ duyệt</span>
            </span>
          )}

          {/* Phản hồi yêu cầu cập nhật từ Ban điều hành */}
          {task.updateFeedback && (
            <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-300 dark:border-amber-500/30 text-[10px]">
              <div className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 mb-0.5">
                <FileText className="w-3 h-3" /> Phản hồi của Ban điều hành:
              </div>
              <div className="text-slate-700 dark:text-slate-300">{task.updateFeedback}</div>
            </div>
          )}

          {/* President quick approve for tasks in progress */}
          {isPresident && task.status !== 'completed' && task.status !== 'pending_approval' && onQuickApprove && (
            <button
              onClick={() => onQuickApprove(task.id)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
              title="Duyệt nhanh hoàn thành"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Task button (President only) */}
          {isPresident && (
            <button
              onClick={() => onDeleteTask(task.id)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-100 text-slate-400 hover:text-red-600 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
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
