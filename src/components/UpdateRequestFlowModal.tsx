import React, { useState } from 'react';
import { X, Send, CheckCircle2, RotateCcw } from 'lucide-react';
import { Member, Task } from '../types';
import { formatDateVN } from '../utils/dateUtils';

interface UpdateRequestFlowModalProps {
  task: Task;
  mode: 'request' | 'respond';
  authMember: Member;
  onClose: () => void;
  onDone: (updated: Task) => void;
}

/**
 * Luồng "Yêu cầu cập nhật minh chứng":
 *  - mode 'request' (người làm): gửi yêu cầu kèm ghi chú -> Ban lãnh đạo/TB phản hồi
 *  - mode 'respond' (Chủ nhiệm/Trưởng ban): xem yêu cầu + điền FEEDBACK -> cho phép cập nhật hoặc từ chối
 */
export const UpdateRequestFlowModal: React.FC<UpdateRequestFlowModalProps> = ({
  task,
  mode,
  authMember,
  onClose,
  onDone,
}) => {
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRespond = mode === 'respond';
  const requester = task.updateRequestById;

  const handleSubmit = async (decision?: 'approve' | 'reject') => {
    if (isRespond && !feedback.trim()) {
      setError('Vui lòng điền nội dung phản hồi (feedback)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { api } = await import('../api/client');
      const body = isRespond
        ? { action: 'respond_update', decision, feedback: feedback.trim() }
        : { action: 'request_update', note: note.trim() };
      const updated = await api<Task>(`/tasks/${task.id}`, { method: 'PUT', body });
      onDone(updated);
    } catch (e: any) {
      setError(e?.message || 'Thao tác thất bại');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              {isRespond ? 'Phản hồi yêu cầu cập nhật' : 'Gửi yêu cầu cập nhật minh chứng'}
            </h2>
            <p className="text-slate-400 mt-0.5 truncate max-w-[300px]">{task.title}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {isRespond && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1">
              <div className="text-amber-300 font-bold text-xs">📥 Yêu cầu từ thành viên</div>
              <div className="text-slate-300">
                {task.updateRequestNote || '(Không ghi chú kèm theo)'}
              </div>
              <div className="text-[10px] text-slate-500">Gửi lúc {formatDateVN(task.updateRequestedAt)}</div>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              {isRespond
                ? 'Phản hồi (feedback) — bắt buộc:'
                : 'Ghi chú kèm yêu cầu (không bắt buộc):'}
            </label>
            <textarea
              rows={4}
              value={isRespond ? feedback : note}
              onChange={(e) => (isRespond ? setFeedback(e.target.value) : setNote(e.target.value))}
              placeholder={
                isRespond
                  ? 'VD: Bổ sung thêm ảnh chụp standee thật, hoàn tất trước thứ Sáu nhé...'
                  : 'VD: Cần chỉnh lại link minh chứng, standee đã đổi thiết kế...'
              }
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2C69FF] resize-none"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">{error}</div>
          )}

          {/* Nút phản hồi: 2 lựa chọn */}
          {isRespond && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSubmit('approve')}
                disabled={busy}
                className="px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Cho phép cập nhật
              </button>
              <button
                onClick={() => handleSubmit('reject')}
                disabled={busy}
                className="px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-red-600/80 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Từ chối
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isRespond && (
          <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Yêu cầu gửi tới Chủ nhiệm & Trưởng ban bộ phận</span>
            <button
              onClick={() => handleSubmit()}
              disabled={busy}
              className="px-4 py-1.5 rounded-lg bg-[#2C69FF] hover:bg-[#1F56D6] text-white font-bold disabled:opacity-50 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {busy ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
