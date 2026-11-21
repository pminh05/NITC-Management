import React, { useState } from 'react';
import {
  Link as LinkIcon,
  FileCheck,
  Send,
  X,
  ExternalLink,
  Info,
  CheckCircle,
} from 'lucide-react';
import { Task } from '../types';

interface EvidenceSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSubmit: (taskId: string, evidenceData: { link?: string; report?: string }) => void;
}

export const EvidenceSubmitModal: React.FC<EvidenceSubmitModalProps> = ({
  isOpen,
  onClose,
  task,
  onSubmit,
}) => {
  const [evidenceLink, setEvidenceLink] = useState('');
  const [evidenceReport, setEvidenceReport] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (task) {
      setEvidenceLink(task.evidenceLink || '');
      setEvidenceReport(task.evidenceReport || '');
      setErrorMsg(null);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  // Count sentences roughly based on punctuation (. ! ?)
  const sentenceCount = evidenceReport
    .trim()
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 3).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (task.verificationType === 'link_required') {
      if (!evidenceLink.trim()) {
        setErrorMsg('Vui lòng nhập đường link bằng chứng (Figma, Google Sheet, Canva, Docs, Github, v.v.)');
        return;
      }
      try {
        new URL(evidenceLink.trim().startsWith('http') ? evidenceLink.trim() : `https://${evidenceLink.trim()}`);
      } catch {
        setErrorMsg('Đường dẫn link không hợp lệ. Vui lòng kiểm tra lại URL.');
        return;
      }
      const formattedLink = evidenceLink.trim().startsWith('http') ? evidenceLink.trim() : `https://${evidenceLink.trim()}`;
      onSubmit(task.id, { link: formattedLink });
    } else {
      if (!evidenceReport.trim()) {
        setErrorMsg('Vui lòng nhập nội dung báo cáo kết quả công việc.');
        return;
      }
      if (sentenceCount < 1) {
        setErrorMsg('Vui lòng viết rõ ít nhất 1-2 câu tóm tắt kết quả.');
        return;
      }
      onSubmit(task.id, { report: evidenceReport.trim() });
    }
  };

  const applyTemplate = (template: string) => {
    setEvidenceReport(template);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-[#101828]/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface border-t sm:border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-200">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1 bg-[#EAECF0] rounded-full mx-auto my-2.5 shrink-0" />
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-light text-primary border border-primary/30">
              {task.verificationType === 'link_required' ? (
                <LinkIcon className="w-5 h-5" />
              ) : (
                <FileCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-fg text-base">
                Nộp Bằng Chứng Hoàn Thành
              </h3>
              <p className="text-xs text-muted">
                {task.department} &bull; {task.assigneeName}
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

        {/* Task Info Pill */}
        <div className="px-6 py-3 bg-surface-2 border-b border-border text-xs">
          <span className="text-muted">Nhiệm vụ: </span>
          <strong className="text-fg">{task.title}</strong>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {task.verificationType === 'link_required' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-fg-2 font-semibold mb-1.5 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-primary" />
                  <span>Dán đường link minh chứng (URL):</span>
                </label>
                <input
                  type="text"
                  value={evidenceLink}
                  onChange={(e) => setEvidenceLink(e.target.value)}
                  placeholder="https://www.figma.com/... hoặc https://docs.google.com/..."
                  className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs sm:text-sm text-fg focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="bg-surface-2 rounded-xl p-3 text-muted space-y-1">
                <div className="flex items-center gap-1.5 text-primary font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Gợi ý nộp sản phẩm:</span>
                </div>
                <p>Hỗ trợ: Link Canva, Figma, Google Drive/Sheets, Form đăng ký, Fanpage Post, GitHub repo.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-fg-2 font-semibold flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Nội dung báo cáo ngắn (Quy tắc 2 câu):</span>
                </label>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  sentenceCount >= 2
                    ? 'bg-success-bg text-success border border-success-bar/30'
                    : 'bg-warning-bg text-warning border border-warning-bar/30'
                }`}>
                  {sentenceCount} câu
                </span>
              </div>

              <textarea
                rows={4}
                value={evidenceReport}
                onChange={(e) => setEvidenceReport(e.target.value)}
                placeholder="Câu 1: Đã làm việc với ai / khảo sát lúc nào...&#10;Câu 2: Kết quả cụ thể và bước tiếp theo..."
                className="w-full p-3.5 bg-surface border border-border rounded-xl text-xs sm:text-sm text-fg focus:outline-none focus:border-purple-500 transition leading-relaxed resize-none"
              />

              {/* Fast Templates */}
              <div>
                <span className="text-muted text-[11px] block mb-1">Mẫu nhanh:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate('Đã gặp Thầy Cố vấn sáng nay và trình kế hoạch. Thầy đã ký duyệt kinh phí và đồng ý hỗ trợ hội trường.')
                    }
                    className="px-2 py-1 rounded bg-surface-2 hover:bg-[#F2F4F7] text-[11px] text-fg-2 border border-border transition"
                  >
                    Mẫu "Gặp Thầy/BQL"
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate('Đã liên hệ trực tiếp đại diện 3 doanh nghiệp qua email và điện thoại. Hai đơn vị đã đồng ý tài trợ gói Bạc, đang chờ gửi hợp đồng.')
                    }
                    className="px-2 py-1 rounded bg-surface-2 hover:bg-[#F2F4F7] text-[11px] text-fg-2 border border-border transition"
                  >
                    Mẫu "Liên hệ Đối tác"
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate('Đã mua đầy đủ văn phòng phẩm và thẻ ban tổ chức theo đúng dự toán. Hóa đơn và chứng từ đã gửi cho Trưởng ban Tài chính.')
                    }
                    className="px-2 py-1 rounded bg-surface-2 hover:bg-[#F2F4F7] text-[11px] text-fg-2 border border-border transition"
                  >
                    Mẫu "Mua đồ/Hậu cần"
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-danger-bg border border-danger-bar/30 rounded-lg text-danger text-xs">
              {errorMsg}
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-muted hover:text-fg hover:bg-surface-2 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi duyệt</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
