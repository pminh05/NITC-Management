import React, { useState } from 'react';
import {
  Sparkles,
  X,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ExtractedDraftTask, Meeting, Member } from '../types';
import { SAMPLE_BBH_TEMPLATES } from '../data/initialData';
import { api } from '../api/client';

interface MeetingParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onExtractionSuccess: (
    meetingData: Partial<Meeting>,
    extractedTasks: ExtractedDraftTask[],
    rawText: string
  ) => void;
}

export const MeetingParserModal: React.FC<MeetingParserModalProps> = ({
  isOpen,
  onClose,
  members,
  onExtractionSuccess,
}) => {
  const [bbhText, setBbhText] = useState(SAMPLE_BBH_TEMPLATES[0].content);
  const [meetingDate, setMeetingDate] = useState('2026-08-18');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_BBH_TEMPLATES.find((s) => s.id === sampleId);
    if (sample) {
      setBbhText(sample.content);
      setMeetingDate(sample.date);
    }
  };

  const handleAnalyze = async () => {
    if (!bbhText.trim()) {
      setErrorMsg('Vui lòng dán nội dung Biên bản họp trước khi phân tích.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await api<{ meeting: any; tasks: ExtractedDraftTask[] }>('/gemini/parse-bbh', {
        method: 'POST',
        body: {
          bbhText,
          members,
          meetingDate,
        },
      });

      const meetingData: Partial<Meeting> = {
        title: data.meeting?.title || 'Biên bản họp Ban Điều Hành',
        date: data.meeting?.date || meetingDate,
        chairperson: data.meeting?.chairperson || 'Lê Hồng Phúc Minh',
        secretary: data.meeting?.secretary || 'Nguyễn Thị Ngọc Ánh',
        attendees: data.meeting?.attendees || [],
        absentees: data.meeting?.absentees || [],
        discussionSummary: data.meeting?.discussionSummary || '',
        actionPlan: data.meeting?.actionPlan || '',
      };

      const extractedTasks: ExtractedDraftTask[] = data.tasks || [];

      onExtractionSuccess(meetingData, extractedTasks, bbhText);
    } catch (err: any) {
      console.error('Error analyzing BBH:', err);
      setErrorMsg(err.message || 'Không thể trích xuất biên bản họp. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                AI Brain: Nhập & Trích xuất Biên bản họp (BBH)
              </h2>
              <p className="text-xs text-slate-400">
                Tự động quét mục Thảo luận & Kế hoạch, quy đổi ngày tháng và phát hiện gán việc
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-200">
          
          {/* Quick template selector bar */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-300">
                Chọn mẫu BBH thực tế của NITC:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_BBH_TEMPLATES.map((sample, idx) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample.id)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-700 hover:bg-indigo-600 hover:text-white text-slate-200 border border-slate-600 transition"
                >
                  Mẫu {idx + 1}: {sample.title.split('-')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Meeting Date selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                Ngày diễn ra cuộc họp (Dùng làm mốc tính Deadline)
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="flex items-center">
              <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-lg p-3 text-xs text-indigo-200/90 w-full flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Quy tắc ngày tháng:</strong> AI sẽ tự động biến các từ như <em>"Thứ Hai tới"</em>, <em>"Tuần sau"</em>, <em>"3 ngày sau họp"</em> thành ngày cụ thể dựa trên mốc ngày họp này.
                </div>
              </div>
            </div>
          </div>

          {/* Main textarea for BBH */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Nội dung toàn văn Biên bản họp (BBH):
              </label>
              <span className="text-xs text-slate-400">
                {bbhText.split('\n').length} dòng | {bbhText.length} ký tự
              </span>
            </div>
            <textarea
              rows={12}
              value={bbhText}
              onChange={(e) => setBbhText(e.target.value)}
              placeholder="Dán nội dung biên bản họp theo mẫu NITC vào đây..."
              className="w-full p-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-indigo-500 transition resize-y leading-relaxed"
            />
          </div>

          {/* Business rules highlight */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                <span>⚠️ Quy tắc "Minh"</span>
              </div>
              <p className="text-slate-400">
                Nếu BBH ghi tên trùng nhiều người, AI không tự gán mà sẽ hiện cảnh báo để Chủ tịch chọn người chính xác.
              </p>
            </div>

            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
              <div className="font-semibold text-red-400 mb-1 flex items-center gap-1.5">
                <span>🚨 Cảnh báo Vắng mặt</span>
              </div>
              <p className="text-slate-400">
                Nếu người được giao việc nằm trong danh sách "Vắng" của BBH, hệ thống lập tức báo động đỏ.
              </p>
            </div>

            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <div className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                <span>🔗 Loại Xác minh</span>
              </div>
              <p className="text-slate-400">
                Tự động phân loại việc cần Link (Design/Slide/Form) hoặc Báo cáo 2 câu (Gặp đối tác/Mua đồ).
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition w-full sm:w-auto"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleAnalyze}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 transition active:scale-95 w-full sm:w-auto cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                <span>AI đang quét & phân tích BBH...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Phân tích & Chuyển sang Bộ lọc Chủ tịch</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
