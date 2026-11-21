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
import { Actor, canRemindTask, canViewWeeklyReport } from '../../shared/permissions';
import { todayVN } from '../../shared/time';

interface TheNagWeeklyReportProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  members: Member[];
  logs: NotificationLog[];
  onSendNotification: (log: Omit<NotificationLog, 'id' | 'sentAt'>) => void;
  /** Người đang mở hộp — quyết định tab nào hiện và việc nào được nhắc */
  actor: Actor;
  /** Nhắc thật (POST /tasks/:id/remind: thông báo trong ứng dụng cho mọi người phụ trách + ghi nhật ký) */
  onRemindTask: (task: Task) => Promise<boolean>;
}

export const TheNagWeeklyReport: React.FC<TheNagWeeklyReportProps> = ({
  isOpen,
  onClose,
  tasks,
  members,
  logs,
  onSendNotification,
  actor,
  onRemindTask,
}) => {
  // Báo cáo tuần chỉ Ban lãnh đạo; Trưởng/Phó ban vào thẳng tab Nhắc việc
  const canWeekly = canViewWeeklyReport(actor);
  const [activeTab, setActiveTab] = useState<'weekly' | 'overdue' | 'logs'>(canWeekly ? 'weekly' : 'overdue');
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
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
  const overdueTasks = tasks.filter((t) => t.status === 'overdue' && canRemindTask(actor, t));

  // Generate Sunday Weekly Report Email
  const currentWeekNumber = (() => {
    // Tuần ISO-8601 của hôm nay (giờ Việt Nam)
    const d = new Date(`${todayVN()}T00:00:00Z`);
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  })();
  const sundayEmailContent = `Kính gửi Toàn thể Ban Điều Hành CLB NITC,

Hệ thống NITC Command Center xin gửi Báo cáo Tổng kết Tiến độ Công việc Tuần ${currentWeekNumber} (Mốc Tối Chủ Nhật):

1. TỔNG QUAN TOÀN CLB:
- Tổng số nhiệm vụ: ${totalTasks}
- Đã hoàn thành: ${totalCompleted} việc (${totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0}%)
- Đang triển khai: ${tasks.filter((t) => t.status === 'in_progress').length} việc
- Chờ duyệt: ${tasks.filter((t) => t.status === 'pending_approval').length} việc
- Quá hạn / Còn nợ: ${totalOverdue} việc

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

  const handleNagSingleTask = async (task: Task) => {
    setSendingIds((s) => new Set(s).add(task.id));
    const ok = await onRemindTask(task);
    setSendingIds((s) => {
      const next = new Set(s);
      next.delete(task.id);
      return next;
    });
    if (ok) {
      setSuccessNotice(`Đã gửi nhắc việc tới ${task.assigneeName}!`);
      setTimeout(() => setSuccessNotice(null), 3000);
    }
    return ok;
  };

  const handleNagAllOverdue = async () => {
    if (overdueTasks.length === 0) return;
    let sent = 0;
    for (const task of overdueTasks) {
      if (await onRemindTask(task)) sent += 1;
    }
    setSuccessNotice(`Đã gửi nhắc việc tới người phụ trách của ${sent}/${overdueTasks.length} việc quá hạn!`);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#101828]/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-danger-bg text-danger border border-danger-bar/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-fg tracking-tight">
                  {canWeekly ? 'Nhắc việc' : `Nhắc việc — Ban ${actor.department}`}
                </h2>
                <span className="bg-danger-bg text-danger text-xs px-2.5 py-0.5 rounded-full font-semibold border border-danger-bar/30">
                  {overdueTasks.length} Quá hạn
                </span>
              </div>
              <p className="text-xs text-muted">
                {canWeekly
                  ? 'Báo cáo tối Chủ nhật cho Ban điều hành & nhắc việc trễ hạn toàn CLB'
                  : 'Nhắc người phụ trách các việc trễ hạn của ban bạn và xem nhật ký đã gửi'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 bg-surface border-b border-border flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {canWeekly && (
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'weekly'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted hover:text-fg hover:bg-surface-2'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Báo Cáo Tối Chủ Nhật (Weekly Summary)</span>
            </button>
            )}

            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'overdue'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-muted hover:text-danger hover:bg-surface-2'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Nhắc Việc Quá Hạn ({overdueTasks.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'logs'
                  ? 'bg-[#F2F4F7] text-fg'
                  : 'text-muted hover:text-fg hover:bg-surface-2'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Nhật Ký Đã Gửi ({logs.length})</span>
            </button>
          </div>
        </div>

        {/* Notification banner */}
        {successNotice && (
          <div className="bg-success-bg border-b border-success-bar/30 px-6 py-2 text-xs text-success flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Tab 1: Sunday Weekly Report */}
        {canWeekly && activeTab === 'weekly' && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1 text-fg text-xs">
            
            {/* Department Leaderboard Cards */}
            <div>
              <h4 className="text-fg-2 font-bold mb-3 flex items-center gap-1.5 text-sm">
                <Users className="w-4 h-4 text-info" />
                <span>Bảng Xếp Hạng Tiến Độ Các Ban Tuần Này</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {deptStats.map((d) => (
                  <div
                    key={d.dept}
                    className="p-3.5 bg-surface-2 border border-border rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-fg">Ban {d.dept}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                        d.rate >= 75
                          ? 'bg-success-bg text-success'
                          : d.rate >= 40
                          ? 'bg-warning-bg text-warning'
                          : 'bg-danger-bg text-danger'
                      }`}>
                        {d.rate}% Xong
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${d.rate}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 text-[11px] text-muted pt-1">
                      <span>Đã xong: <strong className="text-success">{d.completed}</strong></span>
                      <span className="text-right">Quá hạn: <strong className="text-danger">{d.overdue}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Generated Email Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-fg-2 flex items-center gap-1.5 text-sm">
                  <Mail className="w-4 h-4 text-warning" />
                  <span>Bản Thảo Email Chủ Nhật Tự Động (Gửi Toàn BĐH):</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-[#F2F4F7] text-fg font-semibold flex items-center gap-1 border border-border transition"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-success" />
                        <span className="text-success">Đã copy!</span>
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

              <div className="p-4 bg-surface border border-border rounded-xl font-mono text-xs text-fg-2 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {sundayEmailContent}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Overdue Nagging */}
        {activeTab === 'overdue' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1 text-fg text-xs">
            
            <div className="flex items-center justify-between bg-danger-bg border border-danger-bar/30 rounded-xl p-3.5">
              <div>
                <h4 className="font-bold text-danger text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger" />
                  <span>Phát hiện {overdueTasks.length} nhiệm vụ đang ở trạng thái Quá hạn</span>
                </h4>
                <p className="text-muted text-xs mt-0.5">
                  Gửi thông báo nhắc việc tới mọi người phụ trách (kèm email nếu họ bật nhận email).
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
                    className="p-3.5 bg-surface-2 border border-danger-bar/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-danger-bg text-danger font-bold border border-danger-bar/30">
                          {task.department}
                        </span>
                        <span className="font-bold text-fg text-sm">{task.title}</span>
                        {task.isSticky && (
                          <span className="px-2 py-0.5 rounded bg-primary-light text-primary text-[11px] font-semibold flex items-center gap-1">
                            <Pin className="w-3 h-3 rotate-45" />
                            <span>Sticky</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-muted text-xs">
                        <span>Người phụ trách: <strong className="text-fg">{task.assigneeName}</strong></span>
                        <span>Hạn chót: <strong className="text-danger">{formatDateVN(task.deadline)}</strong></span>
                        <span>Loại: {task.verificationType === 'link_required' ? 'Cần Link' : 'Cần Báo cáo'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleNagSingleTask(task)}
                      disabled={sendingIds.has(task.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-danger-bg hover:bg-red-500 text-danger hover:text-fg border border-danger-bar/30 font-semibold flex items-center gap-1.5 transition active:scale-95 shrink-0 disabled:opacity-60 disabled:cursor-wait"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{sendingIds.has(task.id) ? 'Đang gửi…' : 'Gửi Nhắc Việc Gấp'}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-surface-2 rounded-xl border border-border text-muted">
                <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                <p className="font-semibold text-fg">Không có công việc nào bị quá hạn!</p>
                <p className="text-xs mt-1">Mọi thành viên đều đang duy trì tiến độ hoàn hảo.</p>
              </div>
            )}

          </div>
        )}

        {/* Tab 3: Notification History Logs */}
        {activeTab === 'logs' && (
          <div className="p-6 overflow-y-auto space-y-3 flex-1 text-fg text-xs">
            <h4 className="font-bold text-fg-2 text-sm">
              Nhật Ký Thông Báo & Nhắc Việc Đã Gửi ({logs.length})
            </h4>

            {logs.length > 0 ? (
              <div className="space-y-2.5">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-surface-2 border border-border rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          log.type === 'weekly_summary'
                            ? 'bg-primary-light text-primary border border-primary/30'
                            : 'bg-danger-bg text-danger border border-danger-bar/30'
                        }`}>
                          {log.type === 'weekly_summary' ? 'Báo cáo Tuần' : 'Nhắc Quá Hạn'}
                        </span>
                        <span className="font-semibold text-fg">{log.subject}</span>
                      </div>
                      <span className="text-[11px] text-muted">
                        {new Date(log.sentAt).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <div className="text-muted text-xs flex items-center gap-3">
                      <span>Người nhận: <strong>{log.recipientName}</strong></span>
                      <span>Email: <code className="text-fg-2">{log.recipientEmail}</code></span>
                      <span className="text-success font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Đã gửi thành công
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted italic">Chưa có nhật ký gửi thông báo nào.</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-2 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-[#F2F4F7] text-fg text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
