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
  const [approvalNote, setApprovalNote] = useState('Chủ nhiệm đã duyệt: Làm rất tốt, đúng tiến độ!');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  if (!isOpen || !task) return null;

  const handleConfirmApprove = () => {
    onApprove(task.id, approvalNote.trim());
    onClose();
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) {
      alert('Vui lòng nhập lý do yêu cầu làm lại để Trưởng ban nắm rõ.');
      return;
    }
    onReject(task.id, rejectReason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Duyệt Bằng Chứng Hoàn Thành
              </h3>
              <p className="text-xs text-slate-400">
                Quyền hạn Chủ nhiệm &bull; Xác minh tính trách nhiệm
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task Details & Submitted Proof */}
        <div className="p-6 space-y-4 text-xs">
          
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-sm">{task.title}</span>
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                {task.department}
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>{task.assigneeName}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Nộp lúc: {formatDateTimeVN(task.evidenceSubmittedAt)}</span>
              </div>
            </div>
          </div>

          {/* Evidence Content Card */}
          <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2">
            <div className="text-slate-300 font-semibold flex items-center justify-between">
              <span>Minh chứng do thành viên nộp:</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {task.verificationType === 'link_required' ? 'Loại: Link URL' : 'Loại: Báo cáo 2 câu'}
              </span>
            </div>

            {task.verificationType === 'link_required' && task.evidenceLink ? (
              <div className="pt-1">
                <a
                  href={task.evidenceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-700/50 rounded-lg flex items-center justify-between text-indigo-300 font-medium group transition"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <LinkIcon className="w-4 h-4 shrink-0 text-indigo-400" />
                    <span className="truncate underline underline-offset-2">{task.evidenceLink}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 shrink-0 text-indigo-400 group-hover:translate-x-0.5 transition" />
                </a>
              </div>
            ) : task.evidenceReport ? (
              <div className="p-3 bg-slate-950/90 border border-slate-700/70 rounded-lg text-slate-200 text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap">
                "{task.evidenceReport}"
              </div>
            ) : (
              <div className="text-slate-400 italic">Chưa có nội dung minh chứng chi tiết.</div>
            )}
          </div>

          {/* President Feedback / Note */}
          {!isRejecting ? (
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Lời phê của Chủ nhiệm (Ghi chú duyệt hoàn thành):</span>
              </label>
              <input
                type="text"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="VD: Làm rất tốt, duyệt cho triển khai tiếp..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          ) : (
            <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-xl space-y-2">
              <label className="block text-red-300 font-semibold flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span>Lý do yêu cầu làm lại:</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="VD: Link chưa mở quyền truy cập hoặc Báo cáo còn sơ sài, đề nghị làm lại trước 18h..."
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500 transition resize-none"
              />
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
          {!isRejecting ? (
            <>
              <button
                type="button"
                onClick={() => setIsRejecting(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition"
              >
                Yêu cầu làm lại ↩️
              </button>

              <button
                type="button"
                onClick={handleConfirmApprove}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Duyệt Hoàn Thành ✅</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
              >
                Quay lại
              </button>

              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition active:scale-95"
              >
                Gửi Yêu Cầu Nộp Lại
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
