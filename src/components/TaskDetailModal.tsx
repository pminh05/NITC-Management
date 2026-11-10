import React from 'react';
import { X, User, Users, Calendar, FileText, Link as LinkIcon, CheckCircle2, RotateCcw, FileCheck, Flag } from 'lucide-react';
import { Member, Task } from '../types';
import { formatDateVN, formatDateTimeVN, getDaysRemaining } from '../utils/dateUtils';

interface TaskDetailModalProps {
  task: Task | null;
  members: Member[];
  onClose: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, members, onClose }) => {
  if (!task) return null;

  // Danh sách TẤT CẢ người phụ trách (assigneeIds, fallback 1 người)
  let assigneeIds: string[] = [task.assigneeId];
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
    assigneeIds = task.assigneeIds;
  }
  const assignees = assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as Member[];

  const days = getDaysRemaining(task.deadline);
  const meta = TYPE_META(task);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
                Ban {task.department}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${meta.badge}`}>
                {meta.label}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">

          {/* Mô tả */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Mô tả công việc
            </div>
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
              {task.description || 'Không có mô tả.'}
            </p>
          </div>

          {/* Người phụ trách — TẤT CẢ */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              {assignees.length > 1 ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
              Người phụ trách ({assignees.length})
            </div>
            <div className="space-y-1.5">
              {assignees.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200 shrink-0">
                    {m.name.charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                      {m.name}
                      {i === 0 && assignees.length > 1 && (
                        <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">chính</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {m.role} · Ban {m.department}
                    </div>
                  </div>
                </div>
              ))}
              {assignees.length === 0 && (
                <div className="text-slate-400 dark:text-slate-500 p-2">Người phụ trách không còn trong danh sách.</div>
              )}
            </div>
          </div>

          {/* Hạn chót + loại xác minh */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Hạn chót
              </div>
              <div className="text-slate-900 dark:text-slate-200 font-bold">{formatDateVN(task.deadline)}</div>
              {task.status !== 'completed' && (
                <div className={`text-[10px] mt-0.5 font-semibold ${days.isOverdue ? 'text-red-500 dark:text-red-400' : days.isToday ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {days.label}
                </div>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 flex items-center gap-1">
                <FileCheck className="w-3 h-3" /> Xác minh
              </div>
              <div className="text-slate-900 dark:text-slate-200 font-bold">
                {task.verificationType === 'link_required' ? 'Cần Link sản phẩm' : 'Báo cáo 2 câu'}
              </div>
            </div>
          </div>

          {/* Minh chứng */}
          {(task.evidenceLink || task.evidenceReport) && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                Minh chứng đã nộp {task.evidenceSubmittedAt ? `(${formatDateTimeVN(task.evidenceSubmittedAt)})` : ''}
              </div>
              {task.evidenceLink && (
                <a
                  href={task.evidenceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 p-2 rounded-lg bg-[#2C69FF]/10 border border-[#2C69FF]/30 text-[#1E4FC4] dark:text-[#8FB2FF] break-all hover:bg-[#2C69FF]/20 transition"
                >
                  <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                  {task.evidenceLink}
                </a>
              )}
              {task.evidenceReport && (
                <p className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed">
                  "{task.evidenceReport}"
                </p>
              )}
            </div>
          )}

          {/* Yêu cầu cập nhật đang chờ / feedback */}
          {task.updateRequestedAt && !task.updateFeedback && (
            <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="text-purple-700 dark:text-purple-300 font-bold text-xs mb-1">⏳ Yêu cầu cập nhật đang chờ phản hồi</div>
              {task.updateRequestNote && <div className="text-slate-700 dark:text-slate-300">Ghi chú: {task.updateRequestNote}</div>}
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Gửi {formatDateVN(task.updateRequestedAt)}</div>
            </div>
          )}
          {task.updateFeedback && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="text-amber-800 dark:text-amber-300 font-bold text-xs mb-1">🔄 Phản hồi yêu cầu cập nhật</div>
              <div className="text-slate-700 dark:text-slate-300">{task.updateFeedback}</div>
            </div>
          )}

          {/* Kết quả duyệt */}
          {task.approvalNote && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-emerald-700 dark:text-emerald-300 font-bold">Lời phê duyệt</div>
                <div className="text-slate-700 dark:text-slate-300">{task.approvalNote}</div>
              </div>
            </div>
          )}
          {task.rejectedReason && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-red-700 dark:text-red-300 font-bold">Lý do bị trả lại</div>
                <div className="text-slate-700 dark:text-slate-300">{task.rejectedReason}</div>
              </div>
            </div>
          )}

          {/* Nguồn + thời gian */}
          <div className="text-[10px] text-slate-400 dark:text-slate-500 space-y-0.5 border-t border-slate-200 dark:border-slate-800 pt-3">
            {task.sourceMeetingTitle && (
              <div className="flex items-center gap-1">
                <Flag className="w-3 h-3" /> Nguồn: {task.sourceMeetingTitle}
              </div>
            )}
            <div>Tạo: {formatDateTimeVN(task.createdAt)} · Cập nhật: {formatDateTimeVN(task.updatedAt)}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-slate-500">
          <span>Chi tiết công việc</span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold cursor-pointer transition">
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
      return { label: 'Đã hoàn thành', badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' };
    case 'pending_approval':
      return { label: 'Chờ duyệt minh chứng', badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' };
    case 'overdue':
      return { label: 'Quá hạn', badge: 'bg-red-500/15 text-red-400 border border-red-500/30' };
    default: {
      const days = getDaysRemaining(task.deadline);
      return {
        label: days.isOverdue ? 'Trễ hạn' : 'Đang thực hiện',
        badge: days.isOverdue ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
      };
    }
  }
}
