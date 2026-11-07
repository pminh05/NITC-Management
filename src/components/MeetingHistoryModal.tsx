import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  User,
  Users,
  CheckCircle2,
  Clock,
  X,
  Sparkles,
  Search,
  ChevronRight,
} from 'lucide-react';
import { Meeting, Task } from '../types';
import { formatDateVN, isTaskOverdue } from '../utils/dateUtils';
import { exportMeetingToPdf } from '../utils/pdfExport';

interface MeetingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: Meeting[];
  tasks: Task[];
  onOpenBBHParser: () => void;
}

export const MeetingHistoryModal: React.FC<MeetingHistoryModalProps> = ({
  isOpen,
  onClose,
  meetings,
  tasks,
  onOpenBBHParser,
}) => {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    meetings[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];
  const meetingTasks = selectedMeeting
    ? tasks.filter((t) => t.sourceMeetingId === selectedMeeting.id)
    : [];

  const filteredMeetings = meetings.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.date.includes(searchQuery)
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = (meeting: Meeting) => {
    exportMeetingToPdf(meeting, tasks);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Kho Biên Bản Họp & Xuất Bản PDF (NITC Archive)
                </h2>
                <span className="bg-sky-500/20 text-sky-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-sky-500/30">
                  {meetings.length} Biên bản đã lưu
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Lưu trữ tập trung lịch sử các kỳ họp & xuất văn bản chuẩn mẫu hành chính NITC
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

        {/* Content Layout: 2 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-hidden">
          
          {/* Left Column: Meeting List */}
          <div className="p-4 border-r border-slate-800 bg-slate-950/60 overflow-y-auto space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm biên bản họp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-2">
              {filteredMeetings.map((m) => {
                const isSelected = m.id === selectedMeeting?.id;
                const mTasks = tasks.filter((t) => t.sourceMeetingId === m.id);
                const completedTasks = mTasks.filter((t) => t.status === 'completed');

                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMeetingId(m.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      isSelected
                        ? 'bg-sky-950/40 border-sky-500/50 shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono text-sky-400 font-semibold">
                        {formatDateVN(m.date)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {mTasks.length} nhiệm vụ
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-white line-clamp-2 leading-tight mb-2">
                      {m.title}
                    </h4>

                    <div className="mb-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        (m.department || 'Ban Chủ nhiệm') === 'Ban Chủ nhiệm'
                          ? 'bg-[#2C69FF]/15 text-[#8FB2FF] border border-[#2C69FF]/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        {(m.department || 'Ban Chủ nhiệm') === 'Ban Chủ nhiệm' ? '🌐 Toàn CLB' : `🔒 Riêng ban ${m.department}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Chủ trì: {m.chairperson}</span>
                      <span className="text-emerald-400 font-semibold">
                        {completedTasks.length}/{mTasks.length} Xong
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenBBHParser();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Nhập BBH mới</span>
            </button>
          </div>

          {/* Right Column: Selected Meeting Document Viewer */}
          <div className="md:col-span-2 p-6 overflow-y-auto space-y-5 bg-slate-900 text-xs text-slate-200">
            {selectedMeeting ? (
              <>
                {/* Actions Top Bar */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Định dạng xuất:</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadPdf(selectedMeeting)}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Xuất File PDF (.pdf)</span>
                    </button>

                    <button
                      onClick={handlePrint}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>In / Print</span>
                    </button>
                  </div>
                </div>

                {/* Printable Document Box */}
                <div className="p-6 bg-white text-slate-900 dark:text-slate-100 rounded-xl shadow-lg font-serif space-y-4 print:p-0 print:shadow-none">
                  {/* Official Header */}
                  <div className="flex justify-between items-start text-[11px] pb-3 border-b border-slate-300 dark:border-slate-700 leading-tight">
                    <div className="text-center font-bold">
                      <p>CÂU LẠC BỘ CNTT NITC</p>
                      <p className="text-indigo-900">BAN ĐIỀU HÀNH CLB</p>
                      <div className="w-16 h-0.5 bg-slate-800 mx-auto mt-1"></div>
                    </div>
                    <div className="text-center">
                      <p className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                      <p className="italic">Độc lập - Tự do - Hạnh phúc</p>
                      <div className="w-24 h-0.5 bg-slate-800 mx-auto mt-1"></div>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center space-y-1 py-2">
                    <h3 className="font-bold text-base tracking-wide uppercase">
                      BIÊN BẢN HỌP BAN ĐIỀU HÀNH
                    </h3>
                    <p className="italic text-xs text-slate-700 dark:text-slate-300 font-sans">
                      {selectedMeeting.title}
                    </p>
                  </div>

                  {/* General details */}
                  <div className="space-y-1.5 text-xs text-slate-800 dark:text-slate-200 font-sans">
                    <p><strong>1. Thời gian:</strong> Ngày {formatDateVN(selectedMeeting.date)}</p>
                    <p><strong>2. Thành phần chủ trì:</strong> {selectedMeeting.chairperson} (Chủ nhiệm CLB)</p>
                    <p><strong>3. Thư ký cuộc họp:</strong> {selectedMeeting.secretary || 'Nguyễn Thị Ngọc Ánh'}</p>
                    <p><strong>4. Thành phần tham dự:</strong></p>
                    <p className="pl-4 text-slate-700">• Có mặt: {selectedMeeting.attendees?.join(', ') || 'Đầy đủ Ban Điều Hành'}</p>
                    <p className="pl-4 text-red-700">• Vắng mặt: {selectedMeeting.absentees?.length ? selectedMeeting.absentees.join(', ') : 'Không có'}</p>
                  </div>

                  {/* Discussion Summary */}
                  <div className="space-y-1 text-xs text-slate-800 dark:text-slate-200 font-sans pt-2">
                    <p className="font-bold">5. Tóm tắt nội dung thảo luận:</p>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedMeeting.discussionSummary || 'Đã thống nhất các nội dung trọng tâm chuẩn bị sự kiện và phân bổ nhân sự.'}
                    </div>
                  </div>

                  {/* Task Assignment Table */}
                  <div className="space-y-2 text-xs font-sans pt-2">
                    <p className="font-bold text-slate-900">6. Bảng phân công nhiệm vụ & Tiến độ thực tế:</p>
                    
                    <div className="border border-slate-300 dark:border-slate-700 rounded overflow-hidden">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold">
                            <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-8 text-center">STT</th>
                            <th className="p-2 border-r border-slate-300">Nội dung công việc</th>
                            <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-24">Ban / Phụ trách</th>
                            <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-20">Hạn chót</th>
                            <th className="p-2 w-24">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meetingTasks.length > 0 ? (
                            meetingTasks.map((t, idx) => (
                              <tr key={t.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50">
                                <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-center font-bold text-slate-600">
                                  {idx + 1}
                                </td>
                                <td className="p-2 border-r border-slate-300 dark:border-slate-700 font-medium">
                                  {t.title}
                                  {t.isSticky && (
                                    <span className="ml-1 text-[10px] text-purple-700 font-semibold">[Sticky]</span>
                                  )}
                                </td>
                                <td className="p-2 border-r border-slate-300">
                                  <strong>{t.assigneeName}</strong>
                                  <div className="text-[10px] text-slate-500">{t.department}</div>
                                </td>
                                <td className="p-2 border-r border-slate-300 dark:border-slate-700 font-mono">
                                  {formatDateVN(t.deadline)}
                                </td>
                                <td className="p-2 font-semibold">
                                  {t.status === 'completed' ? (
                                    <span className="text-emerald-700">✓ Đã xong</span>
                                  ) : t.status === 'pending_approval' ? (
                                    <span className="text-amber-700">Chờ duyệt</span>
                                  ) : t.status === 'overdue' ? (
                                    <span className="text-red-700">Quá hạn</span>
                                  ) : (
                                    <span className="text-sky-700">Đang làm</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                                {selectedMeeting.actionPlan || 'Xem chi tiết kế hoạch trong nội dung biên bản.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 text-center text-xs font-sans pt-6 pb-4">
                    <div>
                      <p className="font-bold">THƯ KÝ CUỘC HỌP</p>
                      <p className="text-[11px] italic text-slate-500">(Ký và ghi rõ họ tên)</p>
                      <div className="h-12"></div>
                      <p className="font-semibold text-slate-900">{selectedMeeting.secretary || 'Nguyễn Thị Ngọc Ánh'}</p>
                    </div>
                    <div>
                      <p className="font-bold">CHỦ TỊCH CLB NITC</p>
                      <p className="text-[11px] italic text-slate-500">(Ký và ghi rõ họ tên)</p>
                      <div className="h-12"></div>
                      <p className="font-semibold text-slate-900">{selectedMeeting.chairperson || 'Lê Hồng Phúc Minh'}</p>
                    </div>
                  </div>

                </div>
              </>
            ) : (
              <div className="p-8 text-center text-slate-400">
                Chưa chọn biên bản họp nào.
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
