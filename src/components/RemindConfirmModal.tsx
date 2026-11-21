import React, { useState, useMemo } from 'react';
import {
  BellRing,
  X,
  AlertTriangle,
  Calendar,
  Users,
  Send,
  Loader2,
  Clock,
  Link as LinkIcon,
  FileCheck,
} from 'lucide-react';
import { Task, Member } from '../types';
import { formatDateVN, getDaysRemaining } from '../utils/dateUtils';

interface RemindConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  members: Member[];
  onConfirm: (task: Task, note?: string) => Promise<void> | void;
}

export const RemindConfirmModal: React.FC<RemindConfirmModalProps> = ({
  isOpen,
  onClose,
  task,
  members,
  onConfirm,
}) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse tất cả người được giao việc để hiển thị rõ ràng
  const targetMembers = useMemo(() => {
    if (!task) return [];
    const ids: string[] = [];
    if (task.assigneeIds) {
      try {
        const parsed = typeof task.assigneeIds === 'string' ? JSON.parse(task.assigneeIds) : task.assigneeIds;
        if (Array.isArray(parsed)) {
          parsed.forEach((x: any) => {
            if (typeof x === 'string' && x) ids.push(x);
            else if (x && typeof x === 'object' && x.id) ids.push(String(x.id));
          });
        }
      } catch {}
    }
    if (task.assigneeId && !ids.includes(task.assigneeId)) {
      ids.unshift(task.assigneeId);
    }

    const found: Member[] = [];
    ids.forEach((id) => {
      const m = members.find((mem) => mem.id === id);
      if (m && !found.some((x) => x.id === m.id)) found.push(m);
    });

    if (found.length === 0 && task.assigneeName) {
      return [
        {
          id: task.assigneeId || 'temp',
          name: task.assigneeName,
          role: 'Thành viên',
          department: task.department,
        } as Member,
      ];
    }
    return found;
  }, [task, members]);

  if (!isOpen || !task) return null;

  const daysInfo = getDaysRemaining(task.deadline);
  const isOverdue = task.status === 'overdue' || daysInfo.isOverdue;

  const quickNotes = isOverdue
    ? [
        '🚨 Nhiệm vụ đã quá hạn, vui lòng nộp ngay hôm nay!',
        '⚠️ Ban Chủ nhiệm cần báo cáo gấp, hãy hoàn thành sớm!',
      ]
    : [
        '🔔 Nhắc nhẹ: Sắp đến hạn chót, bạn nhớ nộp bài đúng hạn nhé!',
        '📎 Đừng quên đính kèm link Drive/Docs minh chứng khi nộp nhé!',
      ];

  const handleSend = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm(task, note.trim() || undefined);
      setNote('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-[#101828]/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-fg my-auto">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border shadow-2xs ${
                isOverdue
                  ? 'bg-danger-bg text-danger border-danger-bar/30'
                  : 'bg-warning-bg text-warning border-warning-bar/30'
              }`}
            >
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg tracking-tight flex items-center gap-2">
                Xác nhận nhắc nộp minh chứng
                {isOverdue && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-danger-bg text-danger font-bold border border-danger-bar/30">
                    Quá hạn
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted">
                Gửi thông báo chuông đôn đốc đến người phụ trách
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Card thông tin Task */}
          <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-sm text-fg leading-snug">
                {task.title}
              </span>
              <span className="shrink-0 px-2 py-0.5 rounded-md font-semibold text-[10px] bg-info-bg text-info border border-info-bar/30">
                Ban {task.department}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-muted text-[11px] pt-0.5">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-info" />
                <span>
                  Hạn chót: <strong className="text-fg">{formatDateVN(task.deadline)}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-warning" />
                <span className={isOverdue ? 'text-danger font-bold' : 'text-warning'}>
                  {daysInfo.label}
                </span>
              </div>

              <div className="flex items-center gap-1 text-fg-2">
                {task.verificationType === 'report_required' ? (
                  <>
                    <FileCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Cần Báo cáo</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5 text-info" />
                    <span>Cần Link</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Danh sách người sẽ nhận thông báo */}
          <div>
            <label className="block font-bold text-fg-2 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-info" />
                <span>Thành viên sẽ nhận được thông báo ({targetMembers.length}):</span>
              </span>
              <span className="text-[10px] text-muted font-normal">
                (Tất cả người làm việc này)
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-surface-2 border border-border">
              {targetMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 border border-border text-fg font-medium text-xs"
                >
                  <span className="font-bold text-fg">{m.name}</span>
                  <span className="text-[10px] text-muted">({m.role})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lời nhắn tùy chọn */}
          <div>
            <label className="block font-bold text-fg-2 mb-1.5 flex items-center justify-between">
              <span>Lời nhắn đôn đốc (Tùy chọn):</span>
              <span className="text-[10px] text-muted font-normal">Sẽ gửi kèm trong thông báo</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="VD: Cần gấp trước 17h hôm nay để kịp tổng hợp..."
              className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs text-fg placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none leading-relaxed"
            />
            
            {/* Gợi ý nhanh */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {quickNotes.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNote(q)}
                  className="px-2 py-0.5 rounded-md text-[10px] bg-surface-2 hover:bg-[#F2F4F7] text-fg-2 hover:text-fg border border-border transition cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Cảnh báo ghi nhận */}
          <div className="p-2.5 rounded-xl bg-warning-bg border border-warning-bar/30 flex items-start gap-2 text-amber-300/90 text-[11px] leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <span>
              Thông báo nhắc nhở sẽ xuất hiện ngay trong chuông thông báo của các thành viên trên và được ghi vào hệ thống đôn đốc.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-border bg-surface-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer border border-border disabled:opacity-50"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={isSubmitting}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 ${
              isOverdue
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-600/20'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/20'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Xác nhận gửi nhắc nộp</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
