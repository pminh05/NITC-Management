import React, { useState } from 'react';
import {
  Bell,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Send,
  Calendar,
  X,
  Pin,
  Clock,
  Sparkles,
  Check,
  Flame,
  FileText,
  Users,
} from 'lucide-react';
import { Department, Member, NotificationLog, Task } from '../types';
import { formatDateVN, isTaskOverdue } from '../utils/dateUtils';

interface TheNagWeeklyReportProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  members: Member[];
  logs: NotificationLog[];
  onSendNotification: (log: Omit<NotificationLog, 'id' | 'sentAt'>) => void;
}

export const TheNagWeeklyReport: React.FC<TheNagWeeklyReportProps> = ({
  isOpen,
  onClose,
  tasks,
  members,
  logs,
  onSendNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'weekly' | 'overdue' | 'logs'>('weekly');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  // Department statistics
  const departments: Department[] = ['Học thuật', 'Truyền thông', 'Sự kiện', 'Đối ngoại'];
  const deptStats = departments.map((dept) => {
    const deptTasks = tasks.filter((t) => t.department === dept);
    const completed = deptTasks.filter((t) => t.status === 'completed').length;
    const overdue = deptTasks.filter((t) => t.status === 'overdue').length;
    const inProgress = deptTasks.filter((t) => t.status === 'in_progress').length;
    const pending = deptTasks.filter((t) => t.status === 'pending_approval').length;
    const rate = deptTasks.length > 0 ? Math.round((completed / deptTasks.length) * 100) : 0;
    return {
      dept,
      total: deptTasks.length,
      completed,
      overdue,
      inProgress,
      pending,
      rate,
    };
  });

  const totalTasks = tasks.length;
  const totalCompleted = tasks.filter((t) => t.status === 'completed').length;
  const totalOverdue = tasks.filter((t) => t.status === 'overdue').length;
  const totalSticky = tasks.filter((t) => t.isSticky && t.status !== 'completed').length;
  const overdueTasks = tasks.filter((t) => t.status === 'overdue');

  // Generate Sunday Weekly Report Email
  const currentWeekNumber = 34;
  const sundayEmailContent = `Kính gửi Toàn thể Ban Điều Hành CLB NITC,

Hệ thống NITC Command Center xin gửi Báo cáo Tổng kết Tiến độ Công việc Tuần ${currentWeekNumber} (Mốc Tối Chủ Nhật):

1. TỔNG QUAN TOÀN CLB:
- Tổng số nhiệm vụ: ${totalTasks}
- Đã hoàn thành: ${totalCompleted} việc (${totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0}%)
- Đang triển khai: ${tasks.filter((t) => t.status === 'in_progress').length} việc
- Chờ Chủ nhiệm duyệt: ${tasks.filter((t) => t.status === 'pending_approval').length} việc
- Quá hạn / Còn nợ: ${totalOverdue} việc
- Nhiệm vụ Sticky (lưu chuyển từ kỳ trước chưa xong): ${totalSticky} việc

2. TIẾN ĐỘ THEO TỪNG BAN:
${deptStats
  .map(
    (d) =>
      `• Ban ${d.dept}: ${d.completed}/${d.total} việc xong (${d.rate}%) | Quá hạn: ${d.overdue} việc`
  )
  .join('\n')}

3. DANH SÁCH CÔNG VIỆC CÒN TỒN / QUÁ HẠN CẦN GIẢI QUYẾT GẤP:
${
  overdueTasks.length > 0
    ? overdueTasks
        .map(
          (t, i) =>
            `${i + 1}. [${t.department}] ${t.title} - Phụ trách: ${t.assigneeName} (Hạn: ${formatDateVN(t.deadline)})`
        )
        .join('\n')
    : 'Không có công việc nào quá hạn. Toàn đội làm việc rất xuất sắc!'
}

Đề nghị các Trưởng ban chủ động đôn đốc thành viên nộp link minh chứng / báo cáo để Chủ nhiệm phê duyệt trước phiên họp tuần tới.

Trân trọng,
Lê Hồng Phúc Minh - Chủ nhiệm CLB NITC
Hệ thống NITC Command Center`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sundayEmailContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWeeklyEmail = () => {
    setIsSending(true);
    setTimeout(() => {
      onSendNotification({
        type: 'weekly_summary',
        recipientName: 'Toàn thể Ban Điều Hành NITC',
        recipientEmail: 'bdh-nitc-club@googlegroups.com',
        subject: `[NITC BÁO CÁO TUẦN ${currentWeekNumber}] Tổng kết tiến độ công việc & Việc tồn đọng`,
        content: sundayEmailContent,
        taskCount: totalTasks,
        status: 'sent',
      });
      setIsSending(false);
      setSuccessNotice('Đã gửi Báo cáo tuần thành công tới Toàn thể Ban Điều Hành NITC!');
      setTimeout(() => setSuccessNotice(null), 4000);
    }, 600);
  };

  const handleNagSingleTask = (task: Task) => {
    const member = members.find((m) => m.id === task.assigneeId);
    const email = member?.email || `${task.assigneeName.toLowerCase().replace(/\s+/g, '')}@nitc.vn`;

    const subject = `🚨 [NITC NHẮC VIỆC QUÁ HẠN] Công việc "${task.title}" đã quá hạn!`;
    const content = `Chào ${task.assigneeName},\n\nHệ thống NITC Command Center nhận thấy công việc "${task.title}" của bạn đã quá hạn từ ngày ${formatDateVN(task.deadline)}.\n\nVui lòng truy cập hệ thống để nộp ${task.verificationType === 'link_required' ? 'Link sản phẩm (Figma/Sheet/Doc)' : 'Báo cáo ngắn 2 câu'} ngay hôm nay để Chủ nhiệm phê duyệt.\n\nTrân trọng,\nChủ nhiệm NITC.`;

    onSendNotification({
      type: 'overdue_nag',
      recipientName: `${task.assigneeName} (${task.department})`,
      recipientEmail: email,
      department: task.department,
      subject,
      content,
      taskCount: 1,
      status: 'sent',
    });

    setSuccessNotice(`Đã gửi email nhắc việc gấp tới ${task.assigneeName}!`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleNagAllOverdue = () => {
    if (overdueTasks.length === 0) return;
    
    overdueTasks.forEach((task) => {
      handleNagSingleTask(task);
    });

    setSuccessNotice(`Đã kích hoạt gửi email nhắc nợ tự động tới toàn bộ ${overdueTasks.length} thành viên có việc quá hạn!`);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Nhắc việc quá hạn & Báo cáo tuần
                </h2>
                <span className="bg-red-500/20 text-red-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-red-500/30">
                  {totalOverdue} Quá hạn
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tự động gửi Báo cáo tối Chủ nhật & Email nhắc nợ hàng ngày cho các đầu việc trễ hạn
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

        {/* Tab Navigation */}
        <div className="px-6 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'weekly'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Báo Cáo Tối Chủ Nhật (Weekly Summary)</span>
            </button>

            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'overdue'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-red-300 hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Nhắc Việc Quá Hạn ({totalOverdue})</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'logs'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Nhật Ký Đã Gửi ({logs.length})</span>
            </button>
          </div>
        </div>

        {/* Notification banner */}
        {successNotice && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-6 py-2 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Tab 1: Sunday Weekly Report */}
        {activeTab === 'weekly' && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-200 text-xs">
            
            {/* Department Leaderboard Cards */}
            <div>
              <h4 className="text-slate-300 font-bold mb-3 flex items-center gap-1.5 text-sm">
                <Users className="w-4 h-4 text-sky-400" />
                <span>Bảng Xếp Hạng Tiến Độ Các Ban Tuần Này</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {deptStats.map((d) => (
                  <div
                    key={d.dept}
                    className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-white">Ban {d.dept}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                        d.rate >= 75
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : d.rate >= 40
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        {d.rate}% Xong
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${d.rate}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 text-[11px] text-slate-400 pt-1">
                      <span>Đã xong: <strong className="text-emerald-400">{d.completed}</strong></span>
                      <span className="text-right">Quá hạn: <strong className="text-red-400">{d.overdue}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Generated Email Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-300 flex items-center gap-1.5 text-sm">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Bản Thảo Email Chủ Nhật Tự Động (Gửi Toàn BĐH):</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1 border border-slate-700 transition"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Đã copy!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép Email</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSendWeeklyEmail}
                    disabled={isSending}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? 'Đang gửi...' : 'Gửi Tới Toàn BĐH Ngay'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {sundayEmailContent}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Overdue Nagging */}
        {activeTab === 'overdue' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1 text-slate-200 text-xs">
            
            <div className="flex items-center justify-between bg-red-950/20 border border-red-500/30 rounded-xl p-3.5">
              <div>
                <h4 className="font-bold text-red-300 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>Phát hiện {overdueTasks.length} nhiệm vụ đang ở trạng thái Quá hạn</span>
                </h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  Gửi email nhắc nhở đôn đốc khẩn cấp tới từng cá nhân phụ trách.
                </p>
              </div>

              {overdueTasks.length > 0 && (
                <button
                  onClick={handleNagAllOverdue}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 shadow-md transition active:scale-95 shrink-0"
                >
                  <Flame className="w-4 h-4" />
                  <span>Nhắc tất cả việc quá hạn ⚡</span>
                </button>
              )}
            </div>

            {overdueTasks.length > 0 ? (
              <div className="space-y-2.5">
                {overdueTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 bg-slate-800/80 border border-red-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                          {task.department}
                        </span>
                        <span className="font-bold text-white text-sm">{task.title}</span>
                        {task.isSticky && (
                          <span className="px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 text-[11px] font-semibold flex items-center gap-1">
                            <Pin className="w-3 h-3 rotate-45" />
                            <span>Sticky</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-slate-400 text-xs">
                        <span>Người phụ trách: <strong className="text-white">{task.assigneeName}</strong></span>
                        <span>Hạn chót: <strong className="text-red-400">{formatDateVN(task.deadline)}</strong></span>
                        <span>Loại: {task.verificationType === 'link_required' ? 'Cần Link' : 'Cần Báo cáo'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleNagSingleTask(task)}
                      className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-200 hover:text-white border border-red-500/40 font-semibold flex items-center gap-1.5 transition active:scale-95 shrink-0"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Gửi Nhắc Việc Gấp</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-slate-800 text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="font-semibold text-white">Không có công việc nào bị quá hạn!</p>
                <p className="text-xs mt-1">Mọi thành viên đều đang duy trì tiến độ hoàn hảo.</p>
              </div>
            )}

          </div>
        )}

        {/* Tab 3: Notification History Logs */}
        {activeTab === 'logs' && (
          <div className="p-6 overflow-y-auto space-y-3 flex-1 text-slate-200 text-xs">
            <h4 className="font-bold text-slate-300 text-sm">
              Nhật Ký Thông Báo & Nhắc Việc Đã Gửi ({logs.length})
            </h4>

            {logs.length > 0 ? (
              <div className="space-y-2.5">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          log.type === 'weekly_summary'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {log.type === 'weekly_summary' ? 'Báo cáo Tuần' : 'Nhắc Quá Hạn'}
                        </span>
                        <span className="font-semibold text-white">{log.subject}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(log.sentAt).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <div className="text-slate-400 text-xs flex items-center gap-3">
                      <span>Người nhận: <strong>{log.recipientName}</strong></span>
                      <span>Email: <code className="text-slate-300">{log.recipientEmail}</code></span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Đã gửi thành công
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">Chưa có nhật ký gửi thông báo nào.</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
