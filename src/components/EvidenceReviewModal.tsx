import { confirmDialog, toast } from './ui/Feedback';
import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  ExternalLink,
  FileText,
  Clock,
  User,
  X,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Task } from '../types';
import { formatDateTimeVN } from '../utils/dateUtils';

interface EvidenceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onApprove: (taskId: string, approvalNote?: string) => void;
  onReject: (taskId: string, rejectReason: string) => void;
}

export const EvidenceReviewModal: React.FC<EvidenceReviewModalProps> = ({
  isOpen,
  onClose,
  task,
  onApprove,
  onReject,
}) => {
  // Để trống: server tự ghi "<tên> (<chức vụ>) đã duyệt hoàn thành."
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  if (!isOpen || !task) return null;

  const handleConfirmApprove = () => {
    onApprove(task.id, approvalNote.trim());
    onClose();
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) {
      toast('Thiếu lý do', 'Vui lòng nhập lý do yêu cầu làm lại để người làm nắm rõ.', 'warn');
      return;
    }
    onReject(task.id, rejectReason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-[#101828]/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface border-t sm:border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-200">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1 bg-[#EAECF0] rounded-full mx-auto my-2.5 shrink-0" />
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-warning-bg text-warning border border-warning-bar/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-fg text-base">
                Kiểm tra minh chứng
              </h3>
              <p className="text-xs text-muted">
                Duyệt hoàn thành hoặc yêu cầu cập nhật kèm ghi chú
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task Details & Submitted Proof */}
        <div className="p-6 space-y-4 text-xs">
          
          <div className="p-3.5 bg-surface-2 border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-fg text-sm">{task.title}</span>
              <span className="px-2 py-0.5 rounded bg-info-bg text-info font-semibold border border-info-bar/30">
                {task.department}
              </span>
            </div>

            <div className="flex items-center gap-4 text-muted">
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>{task.assigneeName}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-warning" />
                <span>Nộp lúc: {formatDateTimeVN(task.evidenceSubmittedAt)}</span>
              </div>
            </div>
          </div>

          {/* Ghi chú yêu cầu cập nhật từ thành viên */}
          {task.updateRequestedAt && (
            <div className="p-3 bg-primary-light border border-primary/30 rounded-xl space-y-1">
              <div className="text-primary font-bold text-xs">📥 Yêu cầu cập nhật từ thành viên</div>
              <div className="text-fg-2">{task.updateRequestNote || '(Không ghi chú kèm theo)'}</div>
              <div className="text-[10px] text-muted">Gửi {formatDateTimeVN(task.updateRequestedAt)}</div>
            </div>
          )}

          {/* Evidence Content Card */}
          <div className="p-4 bg-surface-2 border border-border rounded-xl space-y-2">
            <div className="text-fg-2 font-semibold flex items-center justify-between">
              <span>Minh chứng do thành viên nộp:</span>
              <span className="text-[11px] text-muted font-mono">
                {task.verificationType === 'link_required' ? 'Loại: Link URL' : 'Loại: Báo cáo 2 câu'}
              </span>
            </div>

            {task.verificationType === 'link_required' && task.evidenceLink ? (
              <div className="pt-1">
                <a
                  href={task.evidenceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-primary-light hover:bg-primary-light border border-primary/30 rounded-lg flex items-center justify-between text-primary font-medium group transition"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <LinkIcon className="w-4 h-4 shrink-0 text-primary" />
                    <span className="truncate underline underline-offset-2">{task.evidenceLink}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 shrink-0 text-primary group-hover:translate-x-0.5 transition" />
                </a>
              </div>
            ) : task.evidenceReport ? (
              <div className="p-3 bg-surface-2 border border-border rounded-lg text-fg text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap">
                "{task.evidenceReport}"
              </div>
            ) : (
              <div className="text-muted italic">Chưa có nội dung minh chứng chi tiết.</div>
            )}
          </div>

          {/* President Feedback / Note */}
          {!isRejecting ? (
            <div>
              <label className="block text-fg-2 font-semibold mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-success" />
                <span>Lời phê khi duyệt (tùy chọn):</span>
              </label>
              <input
                type="text"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="VD: Làm rất tốt, duyệt cho triển khai tiếp..."
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs text-fg focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          ) : (
            <div className="p-3 bg-danger-bg border border-danger-bar/30 rounded-xl space-y-2">
              <label className="block text-danger font-semibold flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-danger" />
                <span>Nội dung cần cập nhật (cho thành viên biết cần sửa gì):</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="VD: Link chưa mở quyền truy cập hoặc Báo cáo còn sơ sài, đề nghị làm lại trước 18h..."
                className="w-full p-2.5 bg-surface border border-border rounded-lg text-xs text-fg focus:outline-none focus:border-red-500 transition resize-none"
              />
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-surface flex items-center justify-between gap-3">
          {!isRejecting ? (
            <>
              <button
                type="button"
                onClick={() => setIsRejecting(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-danger hover:text-danger hover:bg-danger-bg border border-danger-bar/30 transition"
              >
                Yêu cầu cập nhật 🔄
              </button>

              <button
                type="button"
                onClick={handleConfirmApprove}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-fg" />
                <span>Duyệt Hoàn Thành ✅</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="px-3.5 py-2 rounded-xl text-xs text-muted hover:text-fg transition"
              >
                Quay lại
              </button>

              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition active:scale-95"
              >
                Gửi Yêu Cầu Cập Nhật
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
